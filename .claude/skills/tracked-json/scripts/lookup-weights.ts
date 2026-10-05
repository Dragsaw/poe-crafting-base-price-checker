import { type WeightsClassPools, type WeightsFile, WeightsFileSchema } from '@poe/contracts';

import { LookupError } from './lookup-error.ts';

export const WEIGHTS_PATH = 'data/weights.json';

export const SLOTS = ['prefix', 'suffix'] as const;
export type Slot = (typeof SLOTS)[number];

/** Reads one data file as plain JSON; an absent or unparseable file throws `LookupError`. */
export type ReadJson = (path: string) => unknown;

/** Parses the weights file with the contract schema; a failure throws `LookupError`. */
export function loadWeights(read: ReadJson): WeightsFile {
  const parsed = WeightsFileSchema.safeParse(read(WEIGHTS_PATH));
  if (parsed.success) {
    return parsed.data;
  }
  const [issue] = parsed.error.issues;
  const where = issue === undefined || issue.path.length === 0 ? '(root)' : issue.path.map(String).join('.');
  throw new LookupError(`${WEIGHTS_PATH}: ${where}: ${issue?.message ?? 'invalid'}`);
}

export interface ClassSelector {
  readonly className: string;
  readonly category?: string;
}

interface ResolvedClass {
  readonly categoryId: string;
  readonly className: string;
  readonly pools: WeightsClassPools;
}

/** One class's pools. An unknown class, or one in several categories without `category`, throws. */
export function resolveClass(weights: WeightsFile, selector: ClassSelector): ResolvedClass {
  const found: ResolvedClass[] = [];
  for (const [categoryId, classes] of Object.entries(weights.bases)) {
    if (selector.category !== undefined && categoryId !== selector.category) {
      continue;
    }
    const pools = Object.hasOwn(classes, selector.className) ? classes[selector.className] : undefined;
    if (pools !== undefined) {
      found.push({ categoryId, className: selector.className, pools });
    }
  }
  const [only, ...others] = found;
  if (only === undefined) {
    const where = selector.category === undefined ? '' : ` in category ${selector.category}`;
    throw new LookupError(`${WEIGHTS_PATH}: unknown class ${selector.className}${where}`);
  }
  if (others.length > 0) {
    throw new LookupError(
      `${WEIGHTS_PATH}: class ${selector.className} appears in categories ` +
        `${found.map((each) => each.categoryId).join(', ')}; pass --category`,
    );
  }
  return only;
}
