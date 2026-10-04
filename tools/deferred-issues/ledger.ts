import { createHash } from 'node:crypto';

/**
 * The pure half of `pnpm deferred:issues`: it parses
 * `docs/stories/deferred-work.md` and gives each entry its content id.
 *
 * An entry is a top-level `- source_spec:` bullet that has `summary:` and
 * `evidence:` fields. A key line is two spaces of indent, then `[a-z_]+:`. A
 * line with more indent continues the field above it. A blank line, a new
 * top-level bullet or any other unindented line ends the entry. Each value is
 * its lines, trimmed and joined with single spaces. Any other bullet is a note
 * and gets no id.
 *
 * Run by bare `node` (type stripping), so this module imports only builtins.
 */

export interface LedgerEntry {
  readonly id: string;
  readonly title: string;
  readonly sourceSpec: string;
  readonly summary: string;
  readonly evidence: string;
  /** A `retry_when:` precondition that a human wrote, if the entry has one. */
  readonly retryWhen: string | undefined;
  /** Every field of the bullet by key, `source_spec` included. */
  readonly fields: Readonly<Record<string, string>>;
}

export const TITLE_MAX = 70;

const KEY_LINE = /^ {2}([a-z_]+):(.*)$/;
const TOP_BULLET = /^- ([a-z_]+):(.*)$/;

/** `dw-` and the first 10 hex characters of `sha256(sourceSpec + "\n" + summary)`. */
export function entryId(sourceSpec: string, summary: string): string {
  const text = `${sourceSpec}\n${summary}`;
  return `dw-${createHash('sha256').update(text).digest('hex').slice(0, 10)}`;
}

/** The summary with each `"` removed, cut at a word boundary to at most 70 characters. */
export function issueTitle(summary: string): string {
  const text = summary.replaceAll('"', '').replaceAll(/\s+/g, ' ').trim();
  if (text.length <= TITLE_MAX) {
    return text;
  }
  const head = text.slice(0, TITLE_MAX + 1);
  const cut = head.lastIndexOf(' ');
  return (cut > 0 ? head.slice(0, cut) : text.slice(0, TITLE_MAX)).trimEnd();
}

interface OpenEntry {
  readonly fields: Map<string, string[]>;
  current: string[];
}

function beginEntry(firstLine: string): OpenEntry {
  const current = [firstLine];
  return { fields: new Map([['source_spec', current]]), current };
}

function addLine(open: OpenEntry, line: string): void {
  const key = KEY_LINE.exec(line);
  const name = key?.[1];
  if (name !== undefined && !open.fields.has(name)) {
    open.current = [key?.[2] ?? ''];
    open.fields.set(name, open.current);
  } else {
    open.current.push(line);
  }
}

/** The entry that the next line leaves open, after `emit` takes the entry that the line ends. */
function applyLine(
  open: OpenEntry | undefined,
  line: string,
  emit: (finished: OpenEntry | undefined) => void,
): OpenEntry | undefined {
  const top = TOP_BULLET.exec(line);
  // A blank line, a bullet, a heading or a paragraph that is not a key line ends the entry.
  if (top !== null || line.trim() === '' || !line.startsWith('  ')) {
    emit(open);
    return top !== null && top[1] === 'source_spec' ? beginEntry(top[2] ?? '') : undefined;
  }
  if (open !== undefined) {
    addLine(open, line);
  }
  return open;
}

/** Every entry of the ledger text, in ledger order. Notes are left out. */
export function parseLedger(text: string): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const collect = (finished: OpenEntry | undefined): void => {
    const entry = finished === undefined ? undefined : toEntry(finished.fields);
    if (entry !== undefined) {
      entries.push(entry);
    }
  };
  let open: OpenEntry | undefined;
  for (const line of text.split(/\r?\n/)) {
    open = applyLine(open, line, collect);
  }
  collect(open);
  return entries;
}

function toEntry(raw: ReadonlyMap<string, readonly string[]>): LedgerEntry | undefined {
  const fields: Record<string, string> = {};
  for (const [key, lines] of raw) {
    fields[key] = lines
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .join(' ');
  }
  const sourceSpec = fields['source_spec'];
  const summary = fields['summary'];
  const evidence = fields['evidence'];
  if (sourceSpec === undefined || summary === undefined || evidence === undefined) {
    return undefined;
  }
  return {
    id: entryId(sourceSpec, summary),
    title: issueTitle(summary),
    sourceSpec,
    summary,
    evidence,
    retryWhen: fields['retry_when'],
    fields,
  };
}
