import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { CurrenciesFileSchema } from '@poe/contracts';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../test/setup.ts';
import { refreshCurrencies } from './currencies-refresh.ts';
import { capturedBody, existingFile, LEAGUE } from './fixture.ts';
import { POE2SCOUT_BASE, serialiseCurrencies } from './plan.ts';

const ENDPOINT = `${POE2SCOUT_BASE}/Leagues/forbiddenrites/Currencies/ByCategory`;
const NOW = new Date('2026-10-11T12:34:56.789Z');
const EXALTED_RATE = 0.00133;

const scratch: string[] = [];

afterEach(() => {
  for (const directory of scratch.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A temp data directory holding `config.json` and the given `currencies.json` text. */
function makeDataDirectory(currenciesText = serialiseCurrencies(existingFile())) {
  const dataDirectory = mkdtempSync(nodePath.join(tmpdir(), 'currencies-refresh-'));
  scratch.push(dataDirectory);
  writeFileSync(
    nodePath.join(dataDirectory, 'config.json'),
    `${JSON.stringify({ schemaVersion: '1.0.0', league: LEAGUE, minChunkSearches: 1 })}\n`,
  );
  const currenciesPath = nodePath.join(dataDirectory, 'currencies.json');
  writeFileSync(currenciesPath, currenciesText);
  return { dataDirectory, currenciesPath };
}

function sink() {
  const chunks: string[] = [];
  return {
    write: (text: string) => {
      chunks.push(text);
    },
    text: () => chunks.join(''),
  };
}

async function run(dataDirectory: string) {
  const out = sink();
  const error = sink();
  const code = await refreshCurrencies({ dataDirectory, now: () => NOW, out, error });
  return { code, out: out.text(), error: error.text() };
}

function serve(pages: Record<string, unknown>, requestedPages: string[] = []) {
  server.use(
    http.get(ENDPOINT, ({ request }) => {
      const parameters = new URL(request.url).searchParams;
      const page = parameters.get('Page') ?? '';
      requestedPages.push(page);
      const isExpectedQuery = parameters.get('Category') === 'currency' && parameters.get('PerPage') === '100';
      const body = pages[page];
      return body === undefined || !isExpectedQuery ? HttpResponse.json({}, { status: 404 }) : HttpResponse.json(body);
    }),
  );
}

function rateIn(currenciesPath: string, currencyId: string) {
  const file = CurrenciesFileSchema.parse(JSON.parse(readFileSync(currenciesPath, 'utf8')));
  return file.rates.find((rate) => rate.currencyId === currencyId);
}

/** Runs against a fresh directory and reports whether `currencies.json` kept its bytes. */
async function runAndCompare() {
  const { dataDirectory, currenciesPath } = makeDataDirectory();
  const before = readFileSync(currenciesPath);
  const result = await run(dataDirectory);
  return { code: result.code, error: result.error, isUnchanged: readFileSync(currenciesPath).equals(before) };
}

function failedWith(fragment: string): { code: number; error: unknown; isUnchanged: boolean } {
  return { code: 1, error: expect.stringContaining(fragment) as unknown, isUnchanged: true };
}

describe('refreshCurrencies', () => {
  it('rewrites the file from the captured response', async () => {
    const { dataDirectory, currenciesPath } = makeDataDirectory();
    serve({ '1': capturedBody() });

    const result = await run(dataDirectory);

    expect(result.code).toBe(0);
    expect(result.error).toBe('');
    expect(result.out).toContain('wrote 7 rates');
    expect(rateIn(currenciesPath, 'divine')?.rate).toBe(1);
    expect(rateIn(currenciesPath, 'exalted')).toEqual({
      currencyId: 'exalted',
      rate: EXALTED_RATE,
      source: 'measured',
      league: LEAGUE,
      asOf: '2026-10-11T12:34:56Z',
    });
    expect(rateIn(currenciesPath, 'chaos')).toMatchObject({ rate: 0.0937 });
    expect(rateIn(currenciesPath, 'mirror')).toBeUndefined();
  });

  it('keeps an entry the response lacks byte-identical and warns with its id', async () => {
    const extra =
      '    { "currencyId": "not-on-poe2scout", "rate": 0.5, "source": "measured", "league": "Old", "asOf": "2026-09-26T00:00:00Z" }';
    const original = serialiseCurrencies(existingFile()).replace('\n  ]', () => `,\n${extra}\n  ]`);
    const { dataDirectory, currenciesPath } = makeDataDirectory(original);
    serve({ '1': capturedBody() });

    const result = await run(dataDirectory);

    expect(result.code).toBe(0);
    expect(result.error).toContain('warning: not-on-poe2scout');
    expect(readFileSync(currenciesPath, 'utf8')).toContain(`${extra}\n  ]`);
  });

  it('fetches and merges every page', async () => {
    const body = capturedBody();
    const others = body.Items.filter((item) => item.ApiId !== 'divine');
    const divine = body.Items.filter((item) => item.ApiId === 'divine');
    const requested: string[] = [];
    serve(
      {
        '1': { ...body, CurrentPage: 1, Pages: 2, Items: others },
        '2': { ...body, CurrentPage: 2, Pages: 2, Items: divine },
      },
      requested,
    );
    const { dataDirectory, currenciesPath } = makeDataDirectory();

    const result = await run(dataDirectory);

    expect(result.code).toBe(0);
    expect(requested).toEqual(['1', '2']);
    expect(rateIn(currenciesPath, 'exalted')).toMatchObject({ rate: EXALTED_RATE });
  });

  describe('writes nothing and exits 1', () => {
    it('on an HTTP error, naming the status', async () => {
      server.use(http.get(ENDPOINT, () => HttpResponse.text('down', { status: 503 })));
      expect(await runAndCompare()).toEqual(failedWith('HTTP 503'));
    });

    it('on a network error', async () => {
      server.use(http.get(ENDPOINT, () => HttpResponse.error()));
      expect(await runAndCompare()).toEqual(failedWith('failed'));
    });

    it('on a response that fails the schema, naming the issue', async () => {
      serve({ '1': { ...capturedBody(), Items: [{ ApiId: 'divine', CurrentPrice: 'many' }] } });
      expect(await runAndCompare()).toEqual(failedWith('CurrentPrice'));
    });

    it('when the response holds no divine, naming divine', async () => {
      const body = capturedBody();
      serve({ '1': { ...body, Items: body.Items.filter((item) => item.ApiId !== 'divine') } });
      expect(await runAndCompare()).toEqual(failedWith('divine'));
    });
  });
});
