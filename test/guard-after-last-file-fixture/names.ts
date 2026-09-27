/**
 * Shared by the fixture and by `test/guard-after-last-file.test.ts`. A separate
 * module, because importing the fixture itself would register its test in the
 * parent.
 *
 * The URL is under `.invalid` (RFC 2606), so nothing can reach a host.
 */
export const LATE_URL = 'https://after-last-file.invalid/late';
export const ISSUER_TEST = 'starts a timer that fetches after the last file closes';
/** The environment variable that sets the timer delay in milliseconds. */
export const DELAY_ENV = 'GUARD_AFTER_LAST_FILE_DELAY_MS';
