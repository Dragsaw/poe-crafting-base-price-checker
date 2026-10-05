// Shared by the fixtures and `test/guard-reuse.test.ts`; separate because importing a fixture
// would register its tests in the parent. The URL is under `.invalid` (RFC 2606).
export const LATE_URL = 'https://unrouted.invalid/api/trade2/fetch/late-between-files';
export const ISSUER_TEST = 'starts a timer that fetches after this file ends';
export const BYSTANDER_TEST = 'runs after the late request from the earlier file';
