/** The HTTP effect (AD-1). Header-transparent: AD-8 rate governance reads `X-Rate-Limit-*`. */

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
  /** A non-2xx status is a value, not a throw: AD-9 tells 429, 5xx and 4xx apart by consequence. */
  send(request: HttpRequest): Promise<HttpResponse>;
}
