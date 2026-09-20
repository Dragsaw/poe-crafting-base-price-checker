/**
 * The HTTP effect (AD-1). Only `sync` or `web` implements it as an adapter, and
 * exactly one adapter issues every trade request — searches, fetches and
 * catalogue refreshes alike (AD-8).
 *
 * The port is deliberately header-transparent in both directions: AD-8's rate
 * governance reads `X-Rate-Limit-*` **at runtime** and never enumerates rule
 * names in code, so a port that hid response headers would make that impossible
 * to implement.
 */

export interface HttpRequest {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  /** Header names are compared lower-case by every adapter and fake. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface HttpPort {
  /**
   * Issues one request and returns its response, **including every response
   * header**. A non-2xx status is a value, not a throw: AD-9 distinguishes a
   * 429, a 5xx and a 4xx by consequence, and a port that threw would erase the
   * distinction before the caller saw it.
   */
  send(request: HttpRequest): Promise<HttpResponse>;
}
