# Exam Vault design system: "Sealed paper"

Exam Vault should feel like an exam hall: calm, formal, and trustworthy. Surfaces are warm paper, text is near-black ink, and there is one accent, wax red. Wax red means *sealed* or *refused*. A refusal from the network is the product working as intended, so refusals use the accent color and a hatched "refused" style, not a generic error look.

Live showcase: `/design-system`.

## Tokens (`src/styles/tokens.css`)

| Group | Tokens | Notes |
|---|---|---|
| Primitives | `--paper-*`, `--ink-*`, `--wax-*`, `--pine-*`, `--ochre-*`, `--slate-*`, `--crimson-*` | Raw palette. Components should not use these directly. |
| Semantic color | `--color-bg`, `--color-surface`, `--color-surface-sunken`, `--color-border(-strong)`, `--color-text(-muted/-subtle)`, `--color-text-on-accent`, `--color-accent(-hover/-press/-soft/-line)`, `--color-ok(-soft)`, `--color-warn(-soft)`, `--color-danger(-soft)`, `--color-info(-soft)`, `--color-focus`, `--rule-line` | White light theme only. |
| Type families | `--font-serif` (Newsreader), `--font-sans` (IBM Plex Sans), `--font-mono` (IBM Plex Mono) | Serif for headings and paper text, sans for UI, mono for keys, hashes, times and node IDs. |
| Type scale | `--text-xs` 12px through `--text-4xl` 56px; `--leading-*`, `--tracking-caps`, `--weight-*` | |
| Space | `--space-1` 4px through `--space-16` 64px | Based on a 4px unit. |
| Radius | `--radius-xs` 2px, `-sm` 4px, `-md` 6px, `-lg` 10px, `-pill` | Corners stay small, like paper. |
| Elevation | `--shadow-1` (resting), `-2` (raised paper), `-3` (sheet/menu), `--shadow-focus` | |
| Motion | `--duration-fast/base/slow`, `--ease-standard`, `--ease-emphasis` | Durations drop to 0 under `prefers-reduced-motion`. |
| Layout | `--width-content`, `--width-prose`, `--header-height` | |

## Components (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `Button` | Variants `primary` (wax), `secondary`, `ghost`, `danger`. Sizes `sm`/`md`/`lg`. Supports `busy` and `icon`. |
| `Card` | Tones `plain`, `paper` (ruled lines and a double margin rule), `sunken`. Takes optional `eyebrow`, `title` and `actions`. |
| `Badge` | Tones `neutral`, `accent`, `ok`, `warn`, `danger`, `info`. Optional status dot. |
| `Input`, `Textarea`, `Select` | Labelled fields with `hint` and `error`. `mono` for paths and keys. |
| `Tabs`, `TabPanel` | ARIA tabs with arrow-key navigation and a count bubble. |
| `Alert` | Tones `info`, `ok`, `warn`, `danger`, and `refused` (hatched wax). |
| `Table` | Generic typed table with an empty state. |
| `Countdown` | Server-time countdown in tabular mono. Sizes `md`/`lg`. |
| `NodeRing` | Hero visual: 5 ORK nodes around the key core, with node states `idle`/`pending`/`ok`/`refused`/`offline`, an `n/3` counter, and a list of per-node reasons. |
| `QuorumMeter` | Hero visual: a large `n/3` count and three signature lines. When the request commits, a wax seal stamps it. |
| `Seal` | Wax-seal SVG with states `sealed`, `open` and `broken`. |
| `Avatar` | Initials, tinted by role. |
| `Hash` | Shortened monospace value. The full value is in its title. |
| `Icon` | Small stroke icon set (no emoji). |
| `PersonaSwitcher` | Header menu for switching demo personas, grouped by role. |

App-level compositions live in `src/components/app/`: `Header`, `RoleGate`, `SlotList`, `RingCard` (NodeRing in a card), `ExamSheet` (the decrypted paper) and `useVaultRun` (paces node events so the threshold is visible).

## Rules

- Use the accent for one primary action per view, for seals and for refusals. Do not use it for decoration.
- Show every key, digest, signature, node ID and server time in mono.
- When the network refuses, show the node's own reason word for word.
- Use plain English: "Open exam paper", "Approve as An Nguyen", "Access refused by the network".
