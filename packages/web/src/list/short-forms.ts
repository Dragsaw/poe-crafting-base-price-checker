// Short form per `statId` (EXPERIENCE.md, *Chase Combination text uses canonical short forms*).
// A Local stat shares its global twin's form. A leading % marks the percent-increased variant of
// a flat stat; a leading + marks the flat "to" variant of a stat that also rolls as percent.
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
  'explicit.stat_691932474': '+Accuracy',
};

/** The short form for `statId`, or `undefined` for a product gap (no entry in the table). */
export function shortForm(statId: string): string | undefined {
  return Object.hasOwn(SHORT_FORMS, statId) ? SHORT_FORMS[statId] : undefined;
}
