import type { TradeRequest } from '../client.ts';

const USER_AGENT_HEADER = 'user-agent';
const REQUESTED_WITH_HEADER = 'x-requested-with';
const REQUESTED_WITH_VALUE = 'XMLHttpRequest';
const CONTENT_TYPE_HEADER = 'content-type';
const JSON_CONTENT_TYPE = 'application/json';

// Drops the final path segment, where a trade URL varies: keeping it makes every fetch its own lane, unpaced.
function defaultLaneOf(request: TradeRequest): string {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return `${request.method} ${request.url}`;
  }
  const segments = pathname.split('/').filter((segment) => segment !== '');
  return segments.length <= 1 ? `${request.method} ${pathname}` : `${request.method} /${segments.slice(0, -1).join('/')}`;
}

export function laneOf(request: TradeRequest): string {
  return request.lane !== undefined && request.lane.trim() !== '' ? request.lane : defaultLaneOf(request);
}

/** The standing headers of IMPLEMENTATION-NOTES.md §5.1, applied last so a caller cannot drop them. */
export function headersFor(request: TradeRequest, userAgent: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const given = Object.entries(request.headers ?? {});
  for (const [name, value] of given) {
    headers[name.toLowerCase()] = value;
  }
  headers[USER_AGENT_HEADER] = userAgent;
  headers[REQUESTED_WITH_HEADER] = REQUESTED_WITH_VALUE;
  if (request.method === 'POST') {
    headers[CONTENT_TYPE_HEADER] = JSON_CONTENT_TYPE;
  }
  return headers;
}
