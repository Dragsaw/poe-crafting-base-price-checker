/** An `Error` with a runtime-assigned `name`, like `AbortSignal.timeout`'s (`shell.ts`). */
export class NamedError extends Error {
  override readonly name: string;

  constructor(name: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = name;
  }
}
