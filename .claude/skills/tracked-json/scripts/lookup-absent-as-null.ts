// The printed JSON keeps a key for an absent value, which `undefined` would drop.
export function absentAsNull<T>(value: T | undefined): T | null {
  // eslint-disable-next-line unicorn/no-null -- boundary: the subcommands print JSON, where an absent value is `null` and a key must stay.
  return value === undefined ? null : value;
}
