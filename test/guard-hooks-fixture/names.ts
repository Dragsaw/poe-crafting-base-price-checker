// Shared by the fixture and `test/guard-hooks.test.ts`; separate because importing the fixture
// would register its tests in the parent. Every URL is under `.invalid` (RFC 2606).
export const OWN_URL = 'https://unrouted.invalid/api/trade2/fetch/own';
export const LATE_URL = 'https://unrouted.invalid/api/trade2/fetch/late-from-timer';
export const OWN_TEST = 'awaits an unfixtured fetch and drains nothing';
export const LATE_ISSUER = 'starts a late request from a timer';
export const INNOCENT_TEST = 'opens the gate and waits for the late request';
