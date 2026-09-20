import { INITIAL_SCHEMA_VERSION } from '@poe/contracts';

/**
 * Placeholder export. `core` is pure: no I/O, no clock, no randomness, no env.
 * It may import `@poe/contracts` and nothing else in this workspace.
 *
 * Story 1.2 retired `CONTRACTS_PLACEHOLDER`; this now proves the one allowed
 * workspace edge against a real `contracts` export.
 */
export const CORE_PLACEHOLDER = `contracts@${INITIAL_SCHEMA_VERSION}:core`;
