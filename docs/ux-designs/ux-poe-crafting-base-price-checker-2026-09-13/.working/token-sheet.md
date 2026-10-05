# Token sheet — dark redesign (memlog 239–261)

Shared naming contract for the parallel DESIGN.md / EXPERIENCE.md rewrite.
DESIGN.md declares these tokens; EXPERIENCE.md cites them by `{path}` and never restates values.
Values come from `mockups/key-redesign-dark.html` (v7). A token not listed here may be added
by the DESIGN.md editor only when a re-skin needs it; the EXPERIENCE.md editor must not invent tokens.

## colors

| Token | Value | Role |
|---|---|---|
| `ground` | #1A1A1D | page background |
| `surface` | #222226 | open row, expansion panel, row hover, inputs |
| `surface-raised` | #2C2C31 | tooltips, popovers |
| `line` | #2E2E33 | between rows |
| `line-strong` | #44444B | header rule, column-header rule, control borders |
| `text` | #D9D9D9 | primary text, figures, tiers |
| `text-secondary` | #9A9A9A | secondary text, reasons, labels |
| `text-tertiary` | #8A8A8E | rank 6+, column headers, quiet notes, ↗ at rest |
| `rarity-magic` | #8888FF | crafted Item Class names; mod text in the expansion |
| `rarity-magic-dim` | #8C8CCF | mod text in row chase cells |
| `rarity-normal` | #C8C8C8 | Raw Base names |
| `accent` | #BFA77A | interactive: controls, open-row bar, show-more text, ▾ |
| `accent-soft` | rgba(191,167,122,.14) | active segment fill |
| `trust-rough` | #E0913A | ◐ rough and ≈ estimated odds |
| `trust-pending` | #9898A0 | ○ pending |
| `trust-broken` | #F0756C | ✕ broken, problem count, failure-screen eyebrow — broken things only |

## typography

Family: `Inter` (self-hosted in the bundle), fallback `system-ui, "Segoe UI", sans-serif`; tabular figures (`tnum`) everywhere figures align.

| Token | Spec | Use |
|---|---|---|
| `title` | 18px / 600 | header title |
| `eyebrow` | 11px / 600 / uppercase / 0.08em / accent | league name |
| `control` | 13px / 400, active 600 | recipe segments |
| `control-figure` | 15px / 600 | threshold figure |
| `craft-cost` | 13px / 400 / text-secondary | `0.01 div / craft` |
| `label` | 12px / 400 / text-secondary | control labels, sync button |
| `column-header` | 11px / 600 / uppercase / 0.06em / text-tertiary | table headers |
| `row-name` | 15px / 500; top five 600 | names |
| `row-figure` | 15px / 400; top five 650 | EV |
| `row-rank` | 13px; top five 600 text | rank numerals |
| `chase` | 12.5px / 400 | row chase cells |
| `tier` | 0.9em / 600 / text | T1, T1-T2 |
| `line-text` | 13.5px | expansion lines |
| `trust` | 12.5px | mark + word + reason |
| `mark` | 13px | ≈ ◐ ○ ✕ glyphs |
| `tooltip` | 12.5px / 1.45 | tooltips |
| `note` | 12px / text-tertiary | context lines, footer |

## spacing / layout

| Token | Value |
|---|---|
| `content-max` | 1120px |
| `content-min` | 1000px |
| `gutter` | 24px |
| `header-height` | 64px (sticky) |
| `row-height` | 38px |
| `line-height-expansion` | 32px |
| `col-rank` | 32px |
| `col-name` | 220px |
| `col-ev` | 96px (figure + `mark-slot`) |
| `mark-slot` | 18px |
| `col-gap` | 14px |
| `chase-gap` | 18px |
| `expansion-indent` | 46px |
| `expansion-trust-cell` | 270px |
| `open-row-bar` | 2px inset, accent |

## rounded

`control` 6px · `segment` 4px · `tooltip` 6px. Rows and panels: 0.

## components (names only; DESIGN.md writes the specs)

`header-bar`, `recipe-toggle`, `threshold-control` (typed figure + draggable slider), `sync-button` (healthy / problem states), `sync-report-panel`, `column-header`, `ev-tooltip`, `ranked-row` (crafted / raw variants), `trust-mark` (rough / pending / broken), `estimate-mark` (≈), `mark-tooltip`, `chase-cell`, `expansion-panel`, `expansion-line` (priced / rough / pending / broken / below-threshold / pruned), `show-more`, `trade-link`, `unrankable-appendix`, `footer-legend`, `failure-screen`.

Retired names are written without braces: unit-glyph-class, unit-glyph-raw, trust-strip, key-block, masthead, dek, running-foot, uniform-prior-banner, provenance column, age column, paper, sepia, ochre, rust, stack-serif.

## interaction vocabulary (memlog 248)

| Look | Means |
|---|---|
| dotted underline + help cursor | hover for an explanation |
| accent ▾ + outline on hover | click to open |
| accent text | show more / act |
| accent-filled control | a setting |
| row hover highlight + open-row bar | a ranked row opens on click |
