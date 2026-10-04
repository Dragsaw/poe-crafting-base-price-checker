import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpPort, HttpRequest, HttpResponse } from '@poe/contracts';

import { createTradeClient, createTradeGovernor } from '../client.ts';

export const SEARCH_URL = 'https://trade.test/api/trade2/search/poe2/Some%20League';
export const FETCH_URL = 'https://trade.test/api/trade2/fetch/abc';
export const DATA_URL = 'https://trade.test/api/trade2/data/leagues';

export const NOW = '2026-09-20T12:00:00.000Z';
export const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

export function response(
  status: number,
  headers: Readonly<Record<string, string>>,
  body = '{}',
): HttpResponse {
  return { status, headers, body };
}

/** Records what it was asked to wait and returns at once — no wall clock. */
export function recordingWait(): { readonly waits: number[]; wait: (ms: number) => Promise<void> } {
  const waits: number[] = [];
  return {
    waits,
    wait: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

export function harness(fixtures: Readonly<Record<string, HttpResponse>> = {}): {
  readonly http: ReturnType<typeof createFakeHttpPort>;
  readonly clock: ReturnType<typeof createFakeClockPort>;
  readonly waits: number[];
  readonly client: ReturnType<typeof createTradeClient>;
} {
  const http = createFakeHttpPort(fixtures);
  const clock = createFakeClockPort(NOW);
  const { waits, wait } = recordingWait();
  const client = createTradeClient({ http, clock, wait, userAgent: CONTACT });
  return { http, clock, waits, client };
}

export const BODY = '{"query":{"status":{"option":"securable"}}}';
export const BASELINE_BODY = JSON.stringify({ id: 'BASELINE', result: ['r1'] });
export const PROBE_BODY = JSON.stringify({ id: 'PROBE', result: ['r1'] });

type Auth = NonNullable<Parameters<typeof createTradeGovernor>[0]['auth']>;

export interface ProbeFixtures<Holder extends Auth['holder']> {
  readonly clear: Readonly<Record<string, string>>;
  readonly live: Readonly<Record<string, string>>;
  readonly holderFor: (onSettle: (line: string) => void, value: string | undefined) => Holder;
}

export interface Sent {
  readonly port: 'http' | 'probe';
  readonly method: string;
  readonly url: string;
  readonly body: string | undefined;
  readonly cookie: string | undefined;
}

type ProbeAnswer = HttpResponse | ((request: HttpRequest) => Promise<HttpResponse>);

export interface ProbeOptions {
  readonly baseline?: HttpResponse;
  readonly probe?: ProbeAnswer;
  readonly value?: string;
  /** The answer to a request that carries the cookie. Defaults to a live 2xx. */
  readonly cookieAnswer?: (request: HttpRequest) => HttpResponse;
}

function probePorts(headers: Pick<ProbeFixtures<Auth['holder']>, 'clear' | 'live'>, options: ProbeOptions) {
  const sent: Sent[] = [];
  const record = (port: Sent['port'], request: HttpRequest): void => {
    sent.push({
      port,
      method: request.method,
      url: request.url,
      body: request.body,
      cookie: request.headers['cookie'],
    });
  };
  const fake = createFakeHttpPort({
    [`POST ${SEARCH_URL}`]: options.baseline ?? response(200, headers.clear, BASELINE_BODY),
    [`GET ${FETCH_URL}`]: response(200, {}, '{"result":[]}'),
    [`GET ${DATA_URL}`]: response(200, {}, '[]'),
  });
  const cookieAnswer =
    options.cookieAnswer ??
    ((request: HttpRequest) =>
      response(200, headers.live, request.method === 'POST' ? BASELINE_BODY : '{"result":[]}'));
  const http: HttpPort = {
    send(request) {
      record('http', request);
      return request.headers['cookie'] === undefined
        ? fake.send(request)
        : Promise.resolve(cookieAnswer(request));
    },
  };
  const answer: ProbeAnswer = options.probe ?? response(200, headers.live, PROBE_BODY);
  const probe: HttpPort = {
    send(request) {
      record('probe', request);
      return typeof answer === 'function' ? answer(request) : Promise.resolve(answer);
    },
  };
  return { sent, http, probe };
}

export function createProbeHarness<Holder extends Auth['holder']>(
  headers: ProbeFixtures<Holder>,
  options: ProbeOptions = {},
) {
  const { sent, http, probe } = probePorts(headers, options);
  const lines: string[] = [];
  const logs: string[] = [];
  const holder = headers.holderFor((line) => {
    lines.push(line);
  }, options.value);
  const { waits, wait } = recordingWait();
  const governor = createTradeGovernor({
    http: { pricing: http, league: http },
    clock: createFakeClockPort(NOW),
    wait,
    userAgent: CONTACT,
    invalidRequestThreshold: 1,
    log: (line) => {
      logs.push(line);
    },
    auth: { holder, probe },
  });
  const { pricing, league } = governor.clients;
  const search = () =>
    pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY, lane: 'search', cookieEligible: true });
  const fetch = () => pricing.send({ method: 'GET', url: FETCH_URL, lane: 'fetch', cookieEligible: true });
  const leagues = () => league.send({ method: 'GET', url: DATA_URL, lane: 'data' });
  return { sent, lines, logs, holder, waits, governor, probe, search, fetch, leagues };
}

export const probesOf = (sent: readonly Sent[]) => sent.filter((entry) => entry.port === 'probe');
export const httpOf = (sent: readonly Sent[]) => sent.filter((entry) => entry.port === 'http');
