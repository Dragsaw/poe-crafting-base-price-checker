/** A fault in the data or the query. Printed as `{error}` on stdout, exit 1. */
export class LookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LookupError';
  }
}
