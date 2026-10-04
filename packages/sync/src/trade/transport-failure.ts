/**
 * The port rejections that yield the chunk (AD-8), shared by every caller of
 * the governed client: the pricing step (`../pricing/price-entry.ts`) and the
 * league gate (`../league/league-gate.ts`).
 */

/**
 * A timeout (`AbortSignal.timeout` in `shell.ts`, `REQUEST_TIMEOUT_MS`) or a
 * `fetch` network failure. Only these rejections yield; anything else — an
 * unrecorded fixture, a programming error — is rethrown and fails loudly.
 */
export function isTransportFailure(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || (error instanceof TypeError && error.message === 'fetch failed'));
}
