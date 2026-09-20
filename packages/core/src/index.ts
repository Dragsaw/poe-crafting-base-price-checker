import { CONTRACTS_PLACEHOLDER } from '@poe/contracts';

/**
 * Placeholder export. `core` is pure: no I/O, no clock, no randomness, no env.
 * It may import `@poe/contracts` and nothing else in this workspace.
 */
export const CORE_PLACEHOLDER = `${CONTRACTS_PLACEHOLDER}:core`;
