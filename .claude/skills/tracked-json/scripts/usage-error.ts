/** A malformed command line. Printed with the usage text on stderr, exit 1. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}
