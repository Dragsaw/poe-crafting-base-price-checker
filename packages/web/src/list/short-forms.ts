/**
 * The canonical short-form table (EXPERIENCE.md, *Chase Combination text uses
 * canonical short forms*; memlog 34, 118, 231). One form per tracked
 * modifier, keyed by its trade `statId`, a product constant kept by hand in
 * `web` source. It is neither written by the curator nor fetched as an
 * artifact, so tracking a new modifier needs a code change here before it
 * reads in short form. Until then it prints the mono fallback
 * (`combination-text.ts`), and the coverage test in `short-forms.test.ts`
 * fails `pnpm test` as soon as the committed `data/tracked.json` names a
 * `statId` with no form, until the form is added here.
 *
 * Every form obeys the five coinage rules of EXPERIENCE.md, *How a short form
 * may be coined*: a Glossary term is never abbreviated; borrow, never invent
 * (each form is game or trade-site usage); unique across the table; written
 * once and never varied per row; and the tier prefix is never part of a form.
 * A Local variant of a stat (`explicit.stat_210067635`, weapon Attack Speed) 
 * shares the form of its global twin: the player does not tell them apart.
 * A form carries no value. A `%` lead marks the percent-increased variant of a
 * flat stat. A `+` lead marks the flat "to" variant of a stat that also rolls
 * as a percent-increased modifier.
 */
export const SHORT_FORMS: Readonly<Record<string, string>> = {
  'explicit.stat_3981240776': 'Spirit',
  'explicit.stat_2843214518': 'Atk Dmg',
  'explicit.stat_1940865751': 'Flat Phys',
  'explicit.stat_1509134228': '% Phys',
  'explicit.stat_1037193709': 'Flat Cold',
  'explicit.stat_709508406': 'Flat Fire',
  'explicit.stat_3336890334': 'Flat Lightning',
  'explicit.stat_387439868': 'Ele Atk Dmg',
  'explicit.stat_2482852589': '% ES',
  'explicit.stat_2106365538': '% Evasion',
  'explicit.stat_3489782002': 'ES',
  'explicit.stat_3299347043': 'Life',
  'explicit.stat_1050105434': 'Mana',
  'explicit.stat_3917489142': 'Rarity',
  'explicit.stat_983749596': '% Life',
  'explicit.stat_2748665614': '% Mana',
  'explicit.stat_2974417149': 'Spell Dmg',
  'explicit.stat_124131830': 'Spell Skills',
  'explicit.stat_681332047': 'Atk Spd',
  'explicit.stat_210067635': 'Atk Spd',
  'explicit.stat_518292764': '+Crit Chance',
  'explicit.stat_2694482655': '+Crit Dmg',
  'explicit.stat_1202301673': 'Proj Skills',
  'explicit.stat_2463230181': 'Extra Arrow',
  'explicit.stat_1967051901': 'Extra Bolt',
  'explicit.stat_1379411836': 'All Attr',
  'explicit.stat_2901986750': 'All Res',
  'explicit.stat_2923486259': 'Chaos Res',
  'explicit.stat_4220027924': 'Cold Res',
  'explicit.stat_587431675': 'Crit Chance',
  'explicit.stat_3556824919': 'Crit Dmg',
  'explicit.stat_9187492': 'Melee Skills',
  'explicit.stat_2162097452': 'Minion Skills',
  'explicit.stat_2891184298': 'Cast Spd',
  'explicit.stat_328541901': 'Int',
  'explicit.stat_789117908': 'Mana Regen',
};

/** The short form for `statId`, or `undefined` for a product gap (no entry in the table). */
export function shortForm(statId: string): string | undefined {
  return Object.hasOwn(SHORT_FORMS, statId) ? SHORT_FORMS[statId] : undefined;
}
