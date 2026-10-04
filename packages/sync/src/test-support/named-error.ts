/** An `Error` carrying a runtime-assigned `name`, such as the `TimeoutError` of `AbortSignal.timeout` (`shell.ts`). */
export class NamedError extends Error {
  override readonly name: string;

  constructor(name: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = name;
  }
}
