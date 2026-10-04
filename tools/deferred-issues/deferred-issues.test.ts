import { describe, expect, it } from 'vitest';

import { LABELS, LIST_LIMIT, main, type RunResult, type Runner } from './deferred-issues.ts';
import { FIXTURE_LEDGER } from './fixture.ts';
import { parseLedger } from './ledger.ts';
import type { IssueInfo } from './plan.ts';

const ENTRIES = parseLedger(FIXTURE_LEDGER);

interface Call {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly stdin: string | undefined;
}

interface FakeOptions {
  readonly ledger?: string;
  /** `git show` fails, so the ledger cannot be read. */
  readonly gitShowFails?: boolean;
  /** Each `gh issue list` call takes the next item, `undefined` failing it; the last one repeats. */
  readonly lists?: readonly (readonly IssueInfo[] | undefined)[];
  readonly failCreate?: (title: string) => boolean;
  readonly failLabel?: boolean;
  readonly failClose?: boolean;
}

const OK = (stdout = ''): RunResult => ({ status: 0, stdout, stderr: '' });
const FAIL = (stderr: string): RunResult => ({ status: 1, stdout: '', stderr });

/** A runner that spawns nothing: it records each call and answers from the options. */
function fake(options: FakeOptions = {}): { runner: Runner; calls: Call[] } {
  const calls: Call[] = [];
  const lists = options.lists ?? [[]];
  let listCall = 0;
  let nextNumber = 900;
  const answers: Record<string, (arguments_: readonly string[]) => RunResult> = {
    'git show': () =>
      options.gitShowFails === true ? FAIL("fatal: invalid object name 'origin/master'") : OK(options.ledger ?? FIXTURE_LEDGER),
    'gh issue list': () => {
      const list = lists[Math.min(listCall, lists.length - 1)];
      listCall += 1;
      return list === undefined ? FAIL('HTTP 502') : OK(JSON.stringify(list));
    },
    'gh label': () => (options.failLabel === true ? FAIL('HTTP 403') : OK()),
    'gh issue create': (arguments_) => {
      const title = arguments_[arguments_.indexOf('--title') + 1] ?? '';
      if (options.failCreate?.(title) === true) {
        return FAIL('HTTP 422: Validation Failed');
      }
      nextNumber += 1;
      return OK(`https://github.com/o/r/issues/${nextNumber}
`);
    },
    'gh issue close': () => (options.failClose === true ? FAIL('HTTP 500') : OK()),
  };
  const runner: Runner = (command, arguments_, stdin) => {
    calls.push({ cmd: command, args: arguments_, stdin });
    const key = command === 'gh' && arguments_[0] === 'issue' ? `gh issue ${arguments_[1]}` : `${command} ${arguments_[0]}`;
    const answer = answers[key];
    if (answer === undefined) {
      throw new Error(`unexpected call: ${command} ${arguments_.join(' ')}`);
    }
    return answer(arguments_);
  };
  return { runner, calls };
}

function capture(): { write(text: string): void; text(): string } {
  let buffer = '';
  return {
    write(text: string) {
      buffer += text;
    },
    text: () => buffer,
  };
}

function exec(argv: readonly string[], options?: FakeOptions) {
  const { runner, calls } = fake(options);
  const out = capture();
  const error = capture();
  const code = main(argv, runner, out, error);
  return { code, calls, out: out.text(), err: error.text() };
}

function marked(number: number, state: 'OPEN' | 'CLOSED', id: string): IssueInfo {
  return { number, state, body: `Deferred entry: ${id}\n\nbody` };
}

const ALL_OPEN: IssueInfo[] = ENTRIES.map((entry, index) => marked(index + 1, 'OPEN', entry.id));

const writes = (calls: readonly Call[]): Call[] =>
  calls.filter((call) => call.cmd === 'gh' && (call.args[0] === 'label' || ['create', 'close', 'edit', 'comment'].includes(call.args[1] ?? '')));

describe('pnpm deferred:issues', () => {
  it('reads the ledger from origin/master and lists every deferred issue with the limit', () => {
    const { calls } = exec([], { lists: [ALL_OPEN] });
    expect(calls[0]).toEqual({ cmd: 'git', args: ['show', 'origin/master:docs/stories/deferred-work.md'], stdin: undefined });
    expect(calls[1]?.args).toEqual([
      'issue', 'list', '--label', 'deferred', '--state', 'all', '--json', 'number,state,body', '--limit', String(LIST_LIMIT),
    ]);
  });

  it('New entry: creates the labels, then one issue for each entry, with the body on stdin', () => {
    const { code, calls, out } = exec([], { lists: [[], ALL_OPEN] });
    expect(code).toBe(0);
    const labels = calls.filter((call) => call.args[0] === 'label').map((call) => call.args);
    expect(labels).toEqual([
      ['label', 'create', 'deferred', '--color', LABELS[0].color, '--description', LABELS[0].description, '--force'],
      ['label', 'create', 'sweep:blocked', '--color', LABELS[1].color, '--description', LABELS[1].description, '--force'],
    ]);
    const creates = calls.filter((call) => call.args[0] === 'issue' && call.args[1] === 'create');
    expect(creates).toHaveLength(ENTRIES.length);
    expect(creates[0]?.args).toEqual(['issue', 'create', '--title', ENTRIES[0]?.title, '--label', 'deferred', '--body-file', '-']);
    expect(creates[0]?.stdin?.split('\n', 1)[0]).toBe(`Deferred entry: ${ENTRIES[0]?.id}`);
    expect(out).toContain(`${ENTRIES.length} created, 0 closed as duplicate, 0 reported`);
  });

  it('New entry: a failed create is reported, the other ids continue, and the exit is 2', () => {
    const failing = ENTRIES[1]?.title;
    const { code, calls, out } = exec([], { lists: [[], ALL_OPEN], failCreate: (title) => title === failing });
    expect(code).toBe(2);
    expect(calls.filter((call) => call.args[0] === 'issue' && call.args[1] === 'create')).toHaveLength(ENTRIES.length);
    expect(out).toContain(`report: Create failed: ${ENTRIES[1]?.id}: HTTP 422: Validation Failed`);
    expect(out).toContain(`${ENTRIES.length - 1} created`);
  });

  it('Up to date: makes no write, and the output is 0 created', () => {
    const { code, calls, out } = exec([], { lists: [ALL_OPEN] });
    expect(code).toBe(0);
    expect(writes(calls)).toEqual([]);
    expect(out).toContain('0 created');
  });

  it('Race on create: lists again after the creates, keeps the lowest number and closes the rest as not planned', () => {
    const first = ENTRIES[0]?.id ?? '';
    const before = ALL_OPEN.filter((each) => each.number !== 1);
    // Another sync created #7 for the same id between the list and this create (#901).
    const after = [...before, marked(7, 'OPEN', first), marked(901, 'OPEN', first)];
    const { code, calls } = exec([], { lists: [before, after] });
    expect(code).toBe(0);
    expect(calls.filter((call) => call.args[1] === 'list')).toHaveLength(2);
    const closes = calls.filter((call) => call.args[1] === 'close').map((call) => call.args);
    expect(closes).toEqual([['issue', 'close', '901', '--reason', 'not planned', '--comment', 'Duplicate of #7']]);
  });

  it('Race on create: a failed close is reported, and the exit is 2', () => {
    const first = ENTRIES[0]?.id ?? '';
    const before = ALL_OPEN.filter((each) => each.number !== 1);
    const after = [...before, marked(7, 'OPEN', first), marked(901, 'OPEN', first)];
    const { code, out } = exec([], { lists: [before, after], failClose: true });
    expect(code).toBe(2);
    expect(out).toContain('report: Close failed: #901: HTTP 500');
  });

  it('Race on create: a failed re-list after the creates exits 1, after the creates and with no close', () => {
    const { code, calls } = exec([], { lists: [[], undefined] });
    expect(code).toBe(1);
    expect(calls.filter((call) => call.args[0] === 'issue' && call.args[1] === 'create')).toHaveLength(ENTRIES.length);
    expect(calls.filter((call) => call.args[1] === 'close')).toEqual([]);
  });

  it('a duplicate open issue from before the run is closed from the first list, with the labels created', () => {
    const first = ENTRIES[0]?.id ?? '';
    const { code, calls } = exec([], { lists: [[...ALL_OPEN, marked(70, 'OPEN', first)]] });
    expect(code).toBe(0);
    expect(calls.filter((call) => call.args[1] === 'list')).toHaveLength(1);
    expect(calls.filter((call) => call.args[0] === 'label').map((call) => call.args[2])).toEqual(['deferred', 'sweep:blocked']);
    const closes = calls.filter((call) => call.args[1] === 'close').map((call) => call.args);
    expect(closes).toEqual([['issue', 'close', '70', '--reason', 'not planned', '--comment', 'Duplicate of #1']]);
  });

  it('Entry gone: reports an open issue whose id is not on origin/master, and writes nothing', () => {
    const { code, calls, out } = exec([], { lists: [[...ALL_OPEN, marked(80, 'OPEN', 'dw-ffffffffff')]] });
    expect(code).toBe(0);
    expect(writes(calls)).toEqual([]);
    expect(out).toContain('report: Entry gone: #80 names dw-ffffffffff');
  });

  it('Closed, still listed: reports it; no reopen and no new issue', () => {
    const issues = ALL_OPEN.map((each) => (each.number === 1 ? { ...each, state: 'CLOSED' } : each));
    const { code, calls, out } = exec([], { lists: [issues] });
    expect(code).toBe(0);
    expect(writes(calls)).toEqual([]);
    expect(out).toContain(`report: Closed, still listed: ${ENTRIES[0]?.id}`);
  });

  it('No marker: reports the issue and writes nothing', () => {
    // eslint-disable-next-line unicorn/no-null -- boundary: `gh issue list --json body` yields null for an issue with an empty body.
    const { code, calls, out } = exec([], { lists: [[...ALL_OPEN, { number: 2, state: 'OPEN', body: null }]] });
    expect(code).toBe(0);
    expect(writes(calls)).toEqual([]);
    expect(out).toContain('report: No marker: #2 ');
  });

  it('Duplicate ledger id: reports it, creates no issue for that id, and exits 2', () => {
    const block = FIXTURE_LEDGER.split('\n## ', 2)[1] ?? '';
    const ledger = `${FIXTURE_LEDGER}\n## ${block}`;
    const others = ALL_OPEN.filter((each) => each.number !== 1);
    const { code, calls, out } = exec([], { ledger, lists: [others] });
    expect(code).toBe(2);
    expect(calls.filter((call) => call.args[0] === 'issue' && call.args[1] === 'create')).toEqual([]);
    expect(out).toContain(`report: Duplicate ledger id: 2 entries give ${ENTRIES[0]?.id}`);
  });

  describe('Cannot read: no write, exit 1', () => {
    it('when git show fails', () => {
      const { code, calls, err } = exec([], { gitShowFails: true });
      expect(code).toBe(1);
      expect(calls).toHaveLength(1);
      expect(err).toContain('git show origin/master:docs/stories/deferred-work.md failed');
    });

    it('when 0 entries parse', () => {
      const { code, calls, err } = exec([], { ledger: '# Deferred work\n\n- a note\n' });
      expect(code).toBe(1);
      expect(writes(calls)).toEqual([]);
      expect(err).toContain('0 entries parse');
    });

    it('when the issue list fails', () => {
      const { code, calls } = exec([], { lists: [undefined] });
      expect(code).toBe(1);
      expect(writes(calls)).toEqual([]);
    });

    it('when the issue list reaches its limit', () => {
      const full = Array.from({ length: LIST_LIMIT }, (_, index) => marked(index + 1, 'CLOSED', 'dw-0000000000'));
      const { code, calls, err } = exec([], { lists: [full] });
      expect(code).toBe(1);
      expect(writes(calls)).toEqual([]);
      expect(err).toContain('reached its limit of 2000');
    });
  });

  it('a failed label create stops before any issue write, with exit 1', () => {
    const { code, calls } = exec([], { lists: [[]], failLabel: true });
    expect(code).toBe(1);
    expect(calls.filter((call) => call.args[0] === 'issue' && call.args[1] === 'create')).toEqual([]);
  });

  describe('--dry-run', () => {
    it('prints the plan and writes nothing', () => {
      const { code, calls, out } = exec(['--dry-run'], { lists: [[]] });
      expect(code).toBe(0);
      expect(writes(calls)).toEqual([]);
      expect(out).toContain(`would create: ${ENTRIES[0]?.id} ${ENTRIES[0]?.title}`);
      expect(out).toContain(`dry run: ${ENTRIES.length} to create, 0 to close as duplicate, 0 reported`);
    });

    it('reads the ledger at --ref', () => {
      const { calls } = exec(['--dry-run', '--ref', 'HEAD'], { lists: [[]] });
      expect(calls[0]?.args).toEqual(['show', 'HEAD:docs/stories/deferred-work.md']);
    });
  });

  it('refuses --ref without --dry-run, before any call', () => {
    const { code, calls, err } = exec(['--ref', 'HEAD']);
    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(err).toContain('--ref is allowed only with --dry-run');
  });

  it('refuses --list with --dry-run, before any call', () => {
    const { code, calls, err } = exec(['--list', '--dry-run']);
    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(err).toContain('--list and --dry-run do not combine');
  });

  it('refuses an unknown argument', () => {
    const { code, calls } = exec(['--force']);
    expect(code).toBe(1);
    expect(calls).toEqual([]);
  });

  it('--list names the lowest open issue when one id has two, whatever the list order', () => {
    const id = ENTRIES[0]?.id ?? '';
    const { code, out } = exec(['--list'], { lists: [[marked(9, 'OPEN', id), marked(7, 'OPEN', id)]] });
    expect(code).toBe(0);
    const listed = JSON.parse(out) as { issue: number | null }[];
    expect(listed[0]?.issue).toBe(7);
  });

  it('--list prints one JSON object for each entry with its open issue, and writes nothing', () => {
    const issues = [
      marked(3, 'CLOSED', ENTRIES[0]?.id ?? ''),
      marked(5, 'OPEN', ENTRIES[0]?.id ?? ''),
      marked(4, 'OPEN', ENTRIES[2]?.id ?? ''),
    ];
    const { code, calls, out } = exec(['--list'], { lists: [issues] });
    expect(code).toBe(0);
    expect(writes(calls)).toEqual([]);
    const listed = JSON.parse(out) as { id: string; retryWhen: string | null; issue: number | null; summary: string }[];
    expect(listed.map((each) => each.id)).toEqual(ENTRIES.map((entry) => entry.id));
    expect(listed[0]).toMatchObject({ sourceSpec: ENTRIES[0]?.sourceSpec, summary: ENTRIES[0]?.summary, evidence: ENTRIES[0]?.evidence, issue: 5 });
    expect(listed[0]?.retryWhen).toBeNull();
    expect(listed[1]?.issue).toBeNull();
    expect(listed[2]).toMatchObject({ retryWhen: 'A git remote is configured and `deploy.yml` has run once.', issue: 4 });
  });
});
