/**
 * Shared by the fixture and by `test/guard-hooks.test.ts`. A separate module,
 * because importing the fixture itself would register its tests in the parent.
 *
 * Every URL is under `.invalid` (RFC 2606), so nothing can reach a host.
 */
export const OWN_URL = 'https://unrouted.invalid/api/trade2/fetch/own';
export const LATE_URL = 'https://unrouted.invalid/api/trade2/fetch/late-from-timer';
export const OWN_TEST = 'awaits an unfixtured fetch and drains nothing';
export const LATE_ISSUER = 'starts a late request from a timer';
export const INNOCENT_TEST = 'opens the gate and waits for the late request';
