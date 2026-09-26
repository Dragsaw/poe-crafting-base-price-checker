import { createFakeHttpPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createRequestCounter, requestsBetween, zeroRequests } from './request-counter.ts';

const URL_SEARCH = 'https://example.test/search';
const OK = { status: 200, headers: {}, body: '{}' };

describe('createRequestCounter', () => {
  it('starts with all three sources present and zero', () => {
    expect(createRequestCounter().snapshot()).toEqual({
      'tracked-list': 0,
      'league-validation': 0,
      'catalogue-refresh': 0,
    });
  });

  it('counts each request against the source its port was wrapped for, and passes it through', async () => {
    const http = createFakeHttpPort({ [`POST ${URL_SEARCH}`]: OK });
    const counter = createRequestCounter();
    const tracked = counter.counted(http, 'tracked-list');
    const league = counter.counted(http, 'league-validation');

    const request = { method: 'POST', url: URL_SEARCH, headers: {} } as const;
    expect(await tracked.send(request)).toBe(OK);
    await tracked.send(request);
    await league.send(request);

    expect(http.requests).toHaveLength(3);
    expect(counter.snapshot()).toEqual({
      'tracked-list': 2,
      'league-validation': 1,
      'catalogue-refresh': 0,
    });
  });

  it('counts a request whose port rejects', async () => {
    const counter = createRequestCounter();
    const port = counter.counted(createFakeHttpPort(), 'tracked-list');

    await expect(port.send({ method: 'GET', url: URL_SEARCH, headers: {} })).rejects.toThrow(/no fixture/);
    expect(counter.snapshot()['tracked-list']).toBe(1);
  });

  it('a snapshot is a copy, not a live view', async () => {
    const counter = createRequestCounter();
    const before = counter.snapshot();
    await counter
      .counted(createFakeHttpPort({ [`GET ${URL_SEARCH}`]: OK }), 'tracked-list')
      .send({ method: 'GET', url: URL_SEARCH, headers: {} });
    expect(before['tracked-list']).toBe(0);
    expect(requestsBetween(before, counter.snapshot())).toEqual({ ...zeroRequests(), 'tracked-list': 1 });
  });
});
