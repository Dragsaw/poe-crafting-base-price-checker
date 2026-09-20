// Fixture, never built, linted or cruised by the shipped config. Mirrors the
// real `packages/contracts/src` shape so the shipped `^packages/contracts/`
// regex matches it verbatim.
//
// Carries the one edge `no-contracts-to-sibling` forbids.
import type { CoreShape } from '../../core/src/index';

export type ContractsShape = { readonly core: CoreShape };
