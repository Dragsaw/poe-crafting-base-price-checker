/**
 * The contact `User-Agent` overlay (NFR-9, AD-8).
 *
 * Every request identifies the tool and a contact address. The value is **one
 * environment variable holding the whole header verbatim** — nothing is
 * composed in code, so the tool name has exactly one spelling and the contact
 * address lives outside the repository.
 *
 * This is the **only `process.env` read in `sync`**, and it happens at the shell
 * edge. The value is then passed into `createTradeClient` as a value, so no
 * module below the factory performs an environment lookup (Consistency
 * Conventions).
 *
 * When the variable is unset or blank the answer is a typed refusal, never a
 * generic fallback: a request with no descriptive contact is precisely what
 * NFR-9 forbids, and a silent default would keep the omission invisible until
 * GGG noticed it.
 */

export const USER_AGENT_ENV_VAR = 'POE_SYNC_USER_AGENT';

export function missingUserAgentMessage(): string {
  return (
    `${USER_AGENT_ENV_VAR} is unset or blank, so no request can be issued. ` +
    'NFR-9 requires every request to identify the tool and a contact address, and ' +
    `${USER_AGENT_ENV_VAR} carries that whole User-Agent string verbatim. ` +
    'See .env.example for the expected shape.'
  );
}

/**
 * The typed refusal. It is an `Error` subclass because the client refuses at
 * construction, where there is no result value to return, and it names the
 * variable so the fix is in the message rather than in a document.
 */
export class MissingUserAgentError extends Error {
  readonly variable: string = USER_AGENT_ENV_VAR;

  constructor() {
    super(missingUserAgentMessage());
    this.name = 'MissingUserAgentError';
  }
}

export interface UserAgentResolved {
  readonly ok: true;
  readonly userAgent: string;
}

export interface UserAgentRefused {
  readonly ok: false;
  readonly variable: string;
  readonly message: string;
}

export type UserAgentResult = UserAgentResolved | UserAgentRefused;

/**
 * Reads the overlay once. The environment is a parameter so a test supplies one
 * literally; the default is the single `process.env` read this package makes.
 */
export function resolveUserAgent(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): UserAgentResult {
  const raw = environment[USER_AGENT_ENV_VAR];
  const userAgent = raw === undefined ? '' : raw.trim();
  return userAgent === '' ? { ok: false, variable: USER_AGENT_ENV_VAR, message: missingUserAgentMessage() } : { ok: true, userAgent };
}
