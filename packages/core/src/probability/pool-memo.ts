/** A cache of one value per `(pool, key)`, keyed on pool identity: parsed pools never change (AD-24). */
export function memoByPool<P extends object, V extends object>(): (pool: P, key: string, derive: () => V) => V {
  const byPool = new WeakMap<P, Map<string, V>>();
  return (pool, key, derive) => {
    let byKey = byPool.get(pool);
    if (byKey === undefined) {
      byKey = new Map();
      byPool.set(pool, byKey);
    }
    let value = byKey.get(key);
    if (value === undefined) {
      value = derive();
      byKey.set(key, value);
    }
    return value;
  };
}
