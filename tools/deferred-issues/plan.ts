import type { LedgerEntry } from './ledger.ts';

/**
 * The pure diff of `pnpm deferred:issues`: ledger entries against the issues
 * that carry the label `deferred`. It gives the creates, the duplicate closes
 * and the report lines of the spec's I/O & Edge-Case Matrix. It closes only a
 * duplicate issue; every other mismatch is reported and left alone.
 *
 * Run by bare `node` (type stripping), so this module imports only builtins.
 */

export interface IssueInfo {
  readonly number: number;
  /** `OPEN` or `CLOSED`, as `gh issue list --json state` prints it. */
  readonly state: string;
  readonly body: string | null;
}

export interface PlannedCreate {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface PlannedClose {
  readonly number: number;
  /** The issue that stays: the lowest open number with the same id. */
  readonly keep: number;
}

export interface SyncPlan {
  readonly creates: readonly PlannedCreate[];
  readonly closes: readonly PlannedClose[];
  readonly reports: readonly string[];
  /** Ids that two or more ledger entries give. The sync exits 2 on any. */
  readonly duplicateLedgerIds: readonly string[];
}

export const MARKER = /^Deferred entry: (dw-[0-9a-f]{10})$/;
export const LEDGER_PATH = 'docs/stories/deferred-work.md';

/** The id that the first line of an issue body names, or `undefined`. */
export function readMarker(body: string | null | undefined): string | undefined {
  const first = body?.split(/\r?\n/, 1)[0]?.trim() ?? '';
  return MARKER.exec(first)?.[1];
}

/** The body of a new issue. Its first line is the marker. */
export function issueBody(entry: LedgerEntry): string {
  const lines = [
    `Deferred entry: ${entry.id}`,
    '',
    `Created by \`pnpm deferred:issues\` from one entry of \`${LEDGER_PATH}\`. The ledger entry is the record of the work; this issue holds the run state of \`deferred-work-sweep\`. A work PR closes it with \`Closes #<N>\`.`,
    '',
    `- source_spec: ${entry.sourceSpec}`,
    `- summary: ${entry.summary}`,
    `- evidence: ${entry.evidence}`,
  ];
  if (entry.retryWhen !== undefined) {
    lines.push(`- retry_when: ${entry.retryWhen}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Groups the issues by the id of their marker, in number order. */
function byId(issues: readonly IssueInfo[]): Map<string, IssueInfo[]> {
  const groups = new Map<string, IssueInfo[]>();
  const byNumber = issues.toSorted((a, b) => a.number - b.number);
  for (const issue of byNumber) {
    const id = readMarker(issue.body);
    if (id === undefined) {
      continue;
    }
    const group = groups.get(id);
    if (group === undefined) {
      groups.set(id, [issue]);
    } else {
      group.push(issue);
    }
  }
  return groups;
}

/**
 * Each open issue that shares its id with a lower-numbered open issue. The
 * lowest open issue stays, so the sync never closes the issue that `--list`
 * names. A group with no open issue gets no close.
 */
export function planDuplicateCloses(issues: readonly IssueInfo[]): PlannedClose[] {
  const closes: PlannedClose[] = [];
  for (const group of byId(issues).values()) {
    const [keep, ...rest] = group.filter((issue) => issue.state === 'OPEN');
    if (keep === undefined) {
      continue;
    }
    for (const issue of rest) {
      closes.push({ number: issue.number, keep: keep.number });
    }
  }
  return closes.toSorted((a, b) => a.number - b.number);
}

function countIds(entries: readonly LedgerEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  return counts;
}

function markerReports(issues: readonly IssueInfo[]): string[] {
  const reports: string[] = [];
  const byNumber = issues.toSorted((a, b) => a.number - b.number);
  for (const issue of byNumber) {
    if (readMarker(issue.body) === undefined) {
      reports.push(`No marker: #${issue.number} has the label deferred and no valid \`Deferred entry: dw-…\` first line`);
    }
  }
  return reports;
}

export function planSync(entries: readonly LedgerEntry[], issues: readonly IssueInfo[], reference: string): SyncPlan {
  const creates: PlannedCreate[] = [];
  const reports: string[] = [];

  const counts = countIds(entries);
  const duplicateLedgerIds = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
  for (const id of duplicateLedgerIds) {
    reports.push(`Duplicate ledger id: ${counts.get(id)} entries give ${id}; no issue is created for it`);
  }

  reports.push(...markerReports(issues));

  const groups = byId(issues);
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    if (duplicateLedgerIds.includes(entry.id)) {
      continue;
    }
    const group = groups.get(entry.id);
    if (group === undefined) {
      creates.push({ id: entry.id, title: entry.title, body: issueBody(entry) });
    } else if (group.every((issue) => issue.state !== 'OPEN')) {
      const numbers = group.map((issue) => `#${issue.number}`).join(', ');
      reports.push(`Closed, still listed: ${entry.id} is in the ledger, and its issue ${numbers} is closed`);
    }
  }

  const ledgerIds = new Set(counts.keys());
  for (const [id, group] of groups) {
    if (ledgerIds.has(id)) {
      continue;
    }
    for (const issue of group) {
      if (issue.state === 'OPEN') {
        reports.push(`Entry gone: #${issue.number} names ${id}, which is not in ${LEDGER_PATH} on ${reference}`);
      }
    }
  }

  return { creates, closes: planDuplicateCloses(issues), reports, duplicateLedgerIds };
}
