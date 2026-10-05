// The port rejections that yield the chunk (AD-8), shared by the pricing step and the league gate.

/** A timeout or `fetch` network failure. Anything else, such as an unrecorded fixture, rethrows. */
export function isTransportFailure(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || (error instanceof TypeError && error.message === 'fetch failed'));
}
