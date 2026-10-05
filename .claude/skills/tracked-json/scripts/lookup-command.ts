import { parseArgs } from 'node:util';

import { type Slot } from './lookup-weights.ts';
import { UsageError } from './usage-error.ts';

export const USAGE = [
  'usage: pnpm tracked:lookup <subcommand> ...',
  '  stat <query>                                   stat ids whose text or id contains <query>',
  '  base <query>                                   base types whose name contains <query>',
  '  class <query>                                  item classes whose className, categoryId or category text contains <query>',
  '  mods --class <className> [--slot prefix|suffix] [--category <categoryId>]',
  '                                                 the mod groups of one class, per slot',
  '  tiers <statId> --class <className> [--category <categoryId>]',
  '                                                 every tier of one class that carries <statId>, verbatim',
].join('\n');

export type Command =
  | { readonly kind: 'stat' | 'base' | 'class'; readonly query: string }
  | { readonly kind: 'mods'; readonly className: string; readonly slot?: Slot; readonly category?: string }
  | { readonly kind: 'tiers'; readonly statId: string; readonly className: string; readonly category?: string };

function parseOptions(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        class: { type: 'string' },
        slot: { type: 'string' },
        category: { type: 'string' },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

/** Parses the arguments after the script name. Throws `UsageError`. */
export function parseCommand(argv: readonly string[]): Command {
  const { positionals, values } = parseOptions(argv);
  const [kind, query, ...extra] = positionals;
  if (extra.length > 0) {
    throw new UsageError(`unexpected argument ${extra.join(' ')}`);
  }
  switch (kind) {
    case 'stat':
    case 'base':
    case 'class': {
      return parseQueryCommand(kind, query, values);
    }
    case 'mods': {
      return parseModsCommand(query, values);
    }
    case 'tiers': {
      return parseTiersCommand(query, values);
    }
    case undefined: {
      throw new UsageError('missing <subcommand>');
    }
    default: {
      throw new UsageError(`unknown subcommand ${kind}`);
    }
  }
}

type OptionValues = ReturnType<typeof parseOptions>['values'];

function parseQueryCommand(kind: 'stat' | 'base' | 'class', query: string | undefined, values: OptionValues): Command {
  if (query === undefined) {
    throw new UsageError(`${kind}: missing <query>`);
  }
  if (values.category !== undefined || values.class !== undefined || values.slot !== undefined) {
    throw new UsageError(`${kind}: takes no options`);
  }
  return { kind, query };
}

function parseModsCommand(query: string | undefined, values: OptionValues): Command {
  if (query !== undefined) {
    throw new UsageError(`mods: unexpected argument ${query}`);
  }
  if (values.class === undefined) {
    throw new UsageError('mods: missing --class <className>');
  }
  const { category, slot } = values;
  if (slot !== undefined && slot !== 'prefix' && slot !== 'suffix') {
    throw new UsageError(`mods: --slot must be prefix or suffix, not ${slot}`);
  }
  return {
    kind: 'mods',
    className: values.class,
    ...(slot !== undefined && { slot }),
    ...(category !== undefined && { category }),
  };
}

function parseTiersCommand(query: string | undefined, values: OptionValues): Command {
  if (query === undefined) {
    throw new UsageError('tiers: missing <statId>');
  }
  if (values.class === undefined) {
    throw new UsageError('tiers: missing --class <className>');
  }
  if (values.slot !== undefined) {
    throw new UsageError('tiers: takes no --slot; it prints both slots');
  }
  const { category } = values;
  return {
    kind: 'tiers',
    statId: query,
    className: values.class,
    ...(category !== undefined && { category }),
  };
}
