// Carries the one edge `no-sync-to-web` forbids.
import type { WebShape } from '../../web/src/index';

export type SyncShape = { readonly web: WebShape };
