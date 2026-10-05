// The contact `User-Agent` overlay (NFR-9, AD-8): one variable holding the whole header, so the
// contact address stays outside the repository. The only `process.env` read in `sync`, at the
// shell edge. Unset or blank is a typed refusal, never a silent default.

export const USER_AGENT_ENV_VAR = 'POE_SYNC_USER_AGENT';

function missingUserAgentMessage(): string {
  return (
    `${USER_AGENT_ENV_VAR} is unset or blank, so no request can be issued. ` +
    'NFR-9 requires every request to identify the tool and a contact address, and ' +
    `${USER_AGENT_ENV_VAR} carries that whole User-Agent string verbatim. ` +
    'See .env.example for the expected shape.'
  );
}

/** An `Error` because the client refuses at construction, where no result value can be returned. */
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

/** The environment is a parameter so a test supplies one literally. */
export function resolveUserAgent(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): UserAgentResult {
  const raw = environment[USER_AGENT_ENV_VAR];
  const userAgent = raw === undefined ? '' : raw.trim();
  return userAgent === '' ? { ok: false, variable: USER_AGENT_ENV_VAR, message: missingUserAgentMessage() } : { ok: true, userAgent };
}
