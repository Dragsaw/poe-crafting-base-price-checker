import { CONTRACTS_PLACEHOLDER } from '@poe/contracts';
import { CORE_PLACEHOLDER } from '@poe/core';

/**
 * Placeholder export. `sync` is the imperative shell: trade client, rate
 * governor, chunk runner, lock and writers. It may import `@poe/contracts` and
 * `@poe/core`, and never `@poe/web`.
 */
export const SYNC_PLACEHOLDER = `${CORE_PLACEHOLDER}:sync`;

export const SYNC_CONTRACTS_ROOT = CONTRACTS_PLACEHOLDER;
