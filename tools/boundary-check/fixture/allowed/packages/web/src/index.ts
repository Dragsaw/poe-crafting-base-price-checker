import type { ContractsShape } from '../../contracts/src/index';
import type { CoreShape } from '../../core/src/index';

export type WebShape = { readonly contracts: ContractsShape; readonly core: CoreShape };
