import { defenceLettersOf } from '@poe/contracts';
import type { CraftedTrackedEntry, WeightsFile } from '@poe/contracts';

/** §2.6: `fansOut ∧ ¬discriminable` (§10.2 arms 1–3); the detail when it fails, else `undefined`. */
export function classDiscriminability(
  entry: Pick<CraftedTrackedEntry, 'categoryId' | 'className'>,
  weights: WeightsFile,
): string | undefined {
  const classes = Object.hasOwn(weights.bases, entry.categoryId) ? Object.keys(weights.bases[entry.categoryId] ?? {}) : [];
  if (classes.length <= 1) {
    return undefined;
  }
  if (defenceLettersOf(entry.className) !== undefined) {
    return undefined;
  }
  if (classes.every((className) => defenceLettersOf(className) === undefined)) {
    return undefined;
  }
  const siblings = classes.filter((className) => className !== entry.className).length;
  return `className ${entry.className}, categoryId ${entry.categoryId}, ${String(siblings)} sibling ${siblings === 1 ? 'class' : 'classes'}: class not discriminable`;
}
