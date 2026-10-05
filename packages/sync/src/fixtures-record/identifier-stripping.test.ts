import { expect, it } from 'vitest';

import { REDACTED, stripPersonalIdentifiers } from '../fixtures-record.ts';
import { JSON_NULL } from '../test-support/json-null.ts';

it('strips account and character names from a captured payload, keeping the structure', () => {
  const captured = {
    result: [
      {
        id: 'abc',
        listing: {
          account: {
            name: 'SomePlayer#1234',
            lastCharacterName: 'SomeCharacter',
            online: { league: 'Some League' },
          },
          accountName: 'SomePlayer#1234',
          whisper: '@SomeCharacter Hi, I would like to buy your item',
          whisper_token: 'eyJhbGciOiJzb21lLWNoYXJhY3Rlci1uYW1lIn0',
          price: { amount: 1, currency: 'divine' },
        },
      },
    ],
  };

  expect(stripPersonalIdentifiers(captured)).toEqual({
    result: [
      {
        id: 'abc',
        listing: {
          account: {
            name: REDACTED,
            lastCharacterName: REDACTED,
            online: { league: 'Some League' },
          },
          accountName: REDACTED,
          whisper: REDACTED,
          whisper_token: REDACTED,
          price: { amount: 1, currency: 'divine' },
        },
      },
    ],
  });
});

it('strips an identifier held in an array, element by element', () => {
  expect(
    stripPersonalIdentifiers({
      account: { name: ['SomePlayer#1234', 'SomePlayer#5678'] },
      whisper: ['@CharacterOne hi', '@CharacterTwo hi'],
      leagues: ['Some League', 'Another League'],
    }),
  ).toEqual({
    account: { name: [REDACTED, REDACTED] },
    whisper: [REDACTED, REDACTED],
    leagues: ['Some League', 'Another League'],
  });
});

it('strips an identifier nested below an identifier key', () => {
  expect(stripPersonalIdentifiers({ whisper: { template: '@SomeCharacter hi' } })).toEqual({
    whisper: { template: REDACTED },
  });
});

it('leaves a catalogue label named `name` alone — only an identity container hides one', () => {
  const catalogue = {
    result: [
      { id: 'weapon', label: 'Weapons', entries: [{ id: 'weapon.bow', name: 'Bow', text: 'Bow' }] },
    ],
  };

  expect(stripPersonalIdentifiers(catalogue)).toEqual(catalogue);
});

it('leaves a non-string identifier value alone rather than inventing a shape', () => {
  expect(stripPersonalIdentifiers({ account: { name: JSON_NULL, lastCharacterName: 7 } })).toEqual({
    account: { name: JSON_NULL, lastCharacterName: 7 },
  });
});
