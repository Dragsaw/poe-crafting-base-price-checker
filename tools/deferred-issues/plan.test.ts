import { describe, expect, it } from 'vitest';

import { FIXTURE_LEDGER } from './fixture.ts';
import { parseLedger } from './ledger.ts';
import { issueBody, planDuplicateCloses, planSync, readMarker, type IssueInfo } from './plan.ts';

const ENTRIES = parseLedger(FIXTURE_LEDGER);
const [FIRST, SECOND] = ENTRIES;
const REF = 'origin/master';

function issue(number: number, state: 'OPEN' | 'CLOSED', id: string | undefined): IssueInfo {
  return { number, state, body: id === undefined ? 'no marker here' : `Deferred entry: ${id}\n\nbody` };
}

/** One open issue for each fixture entry. */
function allOpen(): IssueInfo[] {
  return ENTRIES.map((entry, index) => issue(index + 1, 'OPEN', entry.id));
}

describe('readMarker', () => {
  it('reads the id from the first body line', () => {
    expect(readMarker('Deferred entry: dw-0123456789\nrest')).toBe('dw-0123456789');
  });

  it('trims the first line and accepts CRLF', () => {
    expect(readMarker('  Deferred entry: dw-0123456789  \r\nrest')).toBe('dw-0123456789');
  });

  it('rejects a null body, a marker on a later line, a longer id and upper-case hex', () => {
    // eslint-disable-next-line unicorn/no-null -- boundary: `gh issue list --json body` yields null for an empty body, which `readMarker` accepts.
    expect(readMarker(null)).toBeUndefined();
    expect(readMarker('')).toBeUndefined();
    expect(readMarker('title\nDeferred entry: dw-0123456789')).toBeUndefined();
    expect(readMarker('Deferred entry: dw-0123456789a')).toBeUndefined();
    expect(readMarker('Deferred entry: dw-012345678A')).toBeUndefined();
  });
});

describe('issueBody', () => {
  it('starts with the marker line that readMarker reads back', () => {
    const body = issueBody(FIRST!);
    expect(body.split('\n', 1)[0]).toBe(`Deferred entry: ${FIRST!.id}`);
    expect(readMarker(body)).toBe(FIRST!.id);
    expect(body).toContain(`- summary: ${FIRST!.summary}`);
  });

  it('carries a human-written retry_when', () => {
    expect(issueBody(ENTRIES[2]!)).toContain('- retry_when: A git remote is configured');
  });
});

describe('planSync', () => {
  it('New entry: creates an issue for an id with no issue in any state', () => {
    const plan = planSync(ENTRIES, [], REF);
    expect(plan.creates.map((create) => create.id)).toEqual(ENTRIES.map((entry) => entry.id));
    expect(plan.creates[0]?.title).toBe(FIRST!.title);
    expect(plan.creates[0]?.body.startsWith(`Deferred entry: ${FIRST!.id}\n`)).toBe(true);
    expect(plan.closes).toEqual([]);
    expect(plan.reports).toEqual([]);
  });

  it('Up to date: no create, no close, no report', () => {
    const plan = planSync(ENTRIES, allOpen(), REF);
    expect(plan).toEqual({ creates: [], closes: [], reports: [], duplicateLedgerIds: [] });
  });

  it('Race on create: keeps the lowest number and closes each other open issue', () => {
    const issues = [...allOpen(), issue(40, 'OPEN', FIRST!.id), issue(41, 'OPEN', FIRST!.id)];
    expect(planSync(ENTRIES, issues, REF).closes).toEqual([
      { number: 40, keep: 1 },
      { number: 41, keep: 1 },
    ]);
  });

  it('Race on create: keeps the lowest open issue when a lower issue is closed', () => {
    const issues = [issue(1, 'CLOSED', FIRST!.id), issue(5, 'OPEN', FIRST!.id), issue(7, 'OPEN', FIRST!.id)];
    expect(planDuplicateCloses(issues)).toEqual([{ number: 7, keep: 5 }]);
  });

  it('Race on create: a group with no open issue gets no close', () => {
    expect(planDuplicateCloses([issue(1, 'CLOSED', FIRST!.id), issue(2, 'CLOSED', FIRST!.id)])).toEqual([]);
  });

  it('Race on create: does not close a duplicate that is already closed', () => {
    expect(planDuplicateCloses([issue(1, 'OPEN', FIRST!.id), issue(2, 'CLOSED', FIRST!.id)])).toEqual([]);
  });

  it('Entry gone: reports an open issue whose id is not in the ledger, and writes nothing', () => {
    const plan = planSync(ENTRIES, [...allOpen(), issue(50, 'OPEN', 'dw-ffffffffff'), issue(51, 'CLOSED', 'dw-eeeeeeeeee')], REF);
    expect(plan.creates).toEqual([]);
    expect(plan.closes).toEqual([]);
    expect(plan.reports).toEqual([
      'Entry gone: #50 names dw-ffffffffff, which is not in docs/stories/deferred-work.md on origin/master',
    ]);
  });

  it('Closed, still listed: reports it, and neither reopens nor creates', () => {
    const issues = allOpen().map((each) => (each.number === 1 ? { ...each, state: 'CLOSED' } : each));
    const plan = planSync(ENTRIES, issues, REF);
    expect(plan.creates).toEqual([]);
    expect(plan.reports).toEqual([`Closed, still listed: ${FIRST!.id} is in the ledger, and its issue #1 is closed`]);
  });

  it('Closed, still listed: a closed issue beside an open one for the same id is fine', () => {
    const plan = planSync(ENTRIES, [...allOpen(), issue(60, 'CLOSED', FIRST!.id)], REF);
    expect(plan.reports).toEqual([]);
    expect(plan.closes).toEqual([]);
  });

  it('No marker: reports the issue and writes nothing for it', () => {
    const plan = planSync(ENTRIES, [...allOpen(), issue(2000, 'OPEN', undefined)], REF);
    expect(plan.creates).toEqual([]);
    expect(plan.closes).toEqual([]);
    expect(plan.reports).toHaveLength(1);
    expect(plan.reports[0]).toMatch(/^No marker: #2000 /);
  });

  it('Duplicate ledger id: reports it and creates no issue for that id', () => {
    const plan = planSync([FIRST!, SECOND!, FIRST!], [], REF);
    expect(plan.duplicateLedgerIds).toEqual([FIRST!.id]);
    expect(plan.creates.map((create) => create.id)).toEqual([SECOND!.id]);
    expect(plan.reports).toEqual([`Duplicate ledger id: 2 entries give ${FIRST!.id}; no issue is created for it`]);
  });
});
