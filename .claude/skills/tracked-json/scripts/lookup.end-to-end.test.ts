import { execFile } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createJsonReader,
  FILTERS_PATH,
  ITEMS_PATH,
  loadWeights,
  lookupBase,
  lookupClass,
  lookupMods,
  lookupStat,
  lookupTiers,
  REPO_ROOT,
  STATS_PATH,
  WEIGHTS_PATH,
} from './lookup';

const SCRIPT = fileURLToPath(new URL('lookup.ts', import.meta.url));
const DATA_DIR = nodePath.join(REPO_ROOT, 'data');

describe('the committed data/', () => {
  const read = createJsonReader(REPO_ROOT);

  it('finds a stat, a base type and a class in the committed catalogue shape', () => {
    expect(lookupStat(read(STATS_PATH), 'to Spirit').matches.map((match) => match.id)).toContain(
      'explicit.stat_3981240776',
    );
    expect(lookupBase(read(ITEMS_PATH), 'amulet').matches).toContainEqual({ type: 'Gold Amulet', group: 'accessory' });
    const classes = lookupClass(loadWeights(read), read(FILTERS_PATH), 'body armour').matches;
    const dex = classes.find((match) => match.className === 'Body_Armours_dex');
    expect(dex).toBeDefined();
    expect(dex?.categoryText).not.toBeNull();
  });

  it('lists the Body_Armours_dex prefixes: 7 modGroups, the defences-and-life hybrid one row', () => {
    const found = lookupMods(loadWeights(read), { className: 'Body_Armours_dex', slot: 'prefix' });

    expect(found.mods).toHaveLength(7);
    const hybrid = found.mods.filter((row) => row.modGroup === 'BaseLocalDefencesAndLife');
    expect(hybrid).toHaveLength(1);
    expect(hybrid[0]?.statIds).toHaveLength(2);
    expect(hybrid[0]?.text).toBe('BaseLocalDefencesAndLife');
    expect(found.mods.filter((row) => row.text === '')).toEqual([]);
  });

  it('offers the Bows phys%+accuracy hybrid prefix as one trackable row', () => {
    const found = lookupMods(loadWeights(read), { className: 'Bows', slot: 'prefix' });
    const hybrid = found.mods.filter((row) => row.modGroup === 'LocalIncreasedPhysicalDamagePercentAndAccuracyRating');

    expect(hybrid).toHaveLength(1);
    expect(hybrid[0]).toMatchObject({
      statIds: ['explicit.stat_1509134228', 'explicit.stat_691932474'],
      trackable: true,
      untrackable: [],
    });
    const tiers = lookupTiers(loadWeights(read), 'explicit.stat_691932474', { className: 'Bows' }).tiers;
    const t1 = tiers.find((row) => row.slot === 'prefix' && row.tierLabel === 'T1');
    expect(t1?.lineSet).toEqual(['explicit.stat_1509134228', 'explicit.stat_691932474']);
    expect(t1?.untrackable).toBeNull();
  });

  it('reports the Time-Lost Diamond IncisionChance as untrackable, and offers JewelRadiusLargerRadius as a one-line family', () => {
    const found = lookupMods(loadWeights(read), { className: 'Time-Lost_Diamond' });
    const incision = found.mods.find((row) => row.modGroup === 'IncisionChance');

    expect(incision).toMatchObject({ slot: 'prefix', statIds: [], trackable: false });
    expect(incision?.untrackable.map((item) => item.reason)).toEqual(['not-in-game']);
    const radius = found.mods.find(
      (row) => row.modGroup === 'JewelRadiusLargerRadius' && row.statIds.includes('explicit.stat_3891355829|1'),
    );
    expect(radius).toMatchObject({ statIds: ['explicit.stat_3891355829|1'], trackable: true, untrackable: [] });
  });

  it('splits the Amulets gem-level suffix modGroup into its four mod families', () => {
    const found = lookupMods(loadWeights(read), { className: 'Amulets', slot: 'suffix' });
    const families = found.mods.filter((row) => row.modGroup === 'IncreaseSocketedGemLevel');

    expect(families.map((row) => row.statIds.length)).toEqual([1, 1, 1, 1]);
    expect(families.map((row) => row.text)).toEqual(Array.from({ length: 4 }, () => 'IncreaseSocketedGemLevel'));
  });
});

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runScript(arguments_: readonly string[]): Promise<Run> {
  return new Promise((done) => {
    const child = execFile(process.execPath, [SCRIPT, ...arguments_], { encoding: 'utf8' }, (_error, stdout, stderr) => {
      done({ code: child.exitCode, stdout, stderr });
    });
  });
}

/** Every path under `data/` with its size and modification time. */
function snapshot(directory: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const name of readdirSync(directory)) {
    const path = nodePath.join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      Object.assign(found, snapshot(path));
    } else {
      found[path] = `${String(stats.size)}:${String(stats.mtimeMs)}`;
    }
  }
  return found;
}

describe('pnpm tracked:lookup', () => {
  it('prints the Amulets spirit prefix tiers T5 to T1, verbatim, and writes nothing to disk', async () => {
    const before = snapshot(DATA_DIR);

    const run = await runScript(['tiers', 'explicit.stat_3981240776', '--class', 'Amulets']);

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    const printed = JSON.parse(run.stdout) as {
      tiers: { slot: string; tierLabel: string; itemLevelMin: number; lines: { ranges: unknown }[] }[];
    };
    const prefixes = printed.tiers.filter((row) => row.slot === 'prefix');
    expect(prefixes.map((row) => [row.tierLabel, row.itemLevelMin])).toEqual([
      ['T5', 16],
      ['T4', 25],
      ['T3', 33],
      ['T2', 46],
      ['T1', 54],
    ]);
    expect(prefixes.map((row) => row.lines[0]?.ranges)).toEqual([
      [[30, 33]],
      [[34, 37]],
      [[38, 42]],
      [[43, 46]],
      [[47, 50]],
    ]);
    expect(snapshot(DATA_DIR)).toEqual(before);
  });

  it('prints a lookup error as {error} on stdout with exit 1', async () => {
    const run = await runScript(['mods', '--class', 'Nope']);

    expect(run.code).toBe(1);
    expect(JSON.parse(run.stdout)).toEqual({ error: `${WEIGHTS_PATH}: unknown class Nope` });
  });

  it('prints the usage on stderr with exit 1 on an unknown subcommand', async () => {
    const run = await runScript(['bogus', 'x']);

    expect(run.code).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('usage: pnpm tracked:lookup');
  });

  it('is reachable at the script name', () => {
    const manifest = JSON.parse(readFileSync(nodePath.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const script = manifest.scripts['tracked:lookup'];

    expect(script).toBe('node .claude/skills/tracked-json/scripts/lookup.ts');
    expect(nodePath.resolve(REPO_ROOT, (script ?? '').split(/\s+/).at(-1) ?? '')).toBe(SCRIPT);
  });
});
