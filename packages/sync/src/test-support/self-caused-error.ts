/** An `Error` whose `cause` is itself, the shape a cause-chain walker must not loop on. */
export class SelfCausedError extends Error {
  override readonly cause: unknown = this;
}
