# SqueekStage design system

## Overview

SqueekStage is a live Squeekchain dashboard for viewers and streamers. Its visual idea is a small golden hamster inside a precise wheel instrument: warm character alongside readable chain data. The implementation retains the existing dark, gold and blue identity and the three established type families.

The overview puts its short headline, two main actions and real wheel readings on the first phone screen. Task pages use the same page heading and panel patterns. A single header provides home, hash navigation and the wallet control; it scrolls with the page. The desktop dashboard pairs the wheel with recent activity, followed by summary metrics and a setup link.

Canonical styles and tokens are in `web/src/styles.css`. Original vector artwork lives in `web/src/graphics.tsx`. This document describes the active React frontend, not the retained legacy `assets/app.css`.

## Colors

Tokens use hex values and semantic roles. The UI is deliberately dark; there is no theme switch or separate light theme.

| Token                  | Value            | Use                                                    |
| ---------------------- | ---------------- | ------------------------------------------------------ |
| `--color-bg`           | `#0b0b0d`        | Page and input background                              |
| `--color-surface`      | `#101013`        | Panels                                                 |
| `--color-raised`       | `#19191f`        | Neutral buttons, wallet rows, notices                  |
| `--color-hover`        | `#202027`        | Neutral control hover                                  |
| `--color-text`         | `#f2f2f4`        | Primary text and default focus ring                    |
| `--color-muted`        | `#a0a0ad`        | Secondary copy, labels and metadata                    |
| `--color-line`         | `#2a2a33`        | Structural borders and dividers                        |
| `--color-control-line` | `#656572`        | Input/button boundaries and link underlines            |
| `--color-accent`       | `#f2c230`        | Primary action fill, brand and wheel emphasis          |
| `--color-accent-hover` | `#ffda58`        | Primary action hover                                   |
| `--color-accent-ink`   | `#13110a`        | Text and icons on gold                                 |
| `--color-secondary`    | `#9aa9ff`        | Sepolia mark and secondary event icons                 |
| `--color-progress`     | `#637dff`        | Round progress, distinct from block progress           |
| `--color-success`      | `#51d799`        | Live status and confirmed feedback                     |
| `--color-error`        | `#ff939c`        | Field and transaction errors                           |
| `--color-focus`        | `#f2f2f4`        | Two-pixel focus perimeter, four-pixel offset           |
| `--overlay-accent`     | Defaults to gold | Saved custom color for overlay progress and alert edge |

Status always has a text label as well as color. Event categories also use different SVG symbols: cube, pulse and coins. Small category backgrounds are `#292415` for settlements and `#1e2233` for checkpoint/reward icons. The stage preview uses a dark dotted background to indicate camera space; the actual OBS output is transparent.

Custom overlay colors affect the progress graphics and alert edge; standard UI text and primary buttons keep the verified palette. Measured default pairs include primary text on the page at **17.59:1**, muted text on the page at **7.61:1**, muted text on a panel at **7.35:1**, and dark button text on gold at **11.27:1**. These are rendered solid pairs, not claims about every user-selected accent or camera background. See `VALIDATION.md` for review limits.

## Typography

All fonts are local WOFF2 files under `web/public/fonts/`, copied to `dist/fonts/` during a build. Each font’s license is included there. The application does not request Google Fonts at runtime.

| Role/token       | Family and available weights                  | Size and behavior                                          |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `--font-body`    | Quicksand 400, 500, 600; system UI fallback   | Interface copy, headings, labels, buttons                  |
| `--font-display` | Barlow Condensed 600; Arial Narrow fallback   | Block count, metric values, wheel percentage               |
| `--font-data`    | IBM Plex Mono 400, 500; UI monospace fallback | Addresses, URLs, times, progress labels and event metadata |
| `--text-caption` | Role-specific family                          | `0.75rem` / 12px                                           |
| `--text-small`   | Role-specific family                          | `0.875rem` / 14px                                          |
| `--text-body`    | Usually Quicksand                             | `1rem` / 16px                                              |
| `--text-title`   | Quicksand or Barlow by role                   | `1.5rem` / 24px                                            |
| `--text-heading` | Quicksand 600                                 | `3rem` / 48px; `2rem` / 32px at ≤700px                     |
| `--text-number`  | Barlow Condensed 600                          | `4.5rem` / 72px; `3rem` / 48px at ≤700px                   |

This is six sizes at any one viewport and three weights. Body text uses line-height 1.5; prose uses 1.6; the main headline uses 1.12; numeric readouts use 1.1–1.3. Headlines balance wrapping and use −0.045em tracking on desktop and −0.04em on mobile. Prose uses natural spacing and a measure up to roughly 64–72 characters. There are no tracked uppercase section labels.

Changing values use tabular numerals. Metric labels use the body family, while the numbers use the condensed display face. Inputs remain 16px on phones. Full addresses wrap anywhere in review/details; the short address in the header opens a dialog showing the full value. URLs use selectable, read-only textareas rather than clipped code blocks. Useful text remains selectable.

## Layout

The shared content and header width is a maximum **1440px**, including their padding. Desktop inline padding is 48px, dropping to 32px at ≤1000px and 20px at ≤700px; at ≤360px it becomes 16px. `box-sizing: border-box` applies throughout. Most spatial declarations use logical properties.

Spacing tokens are `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-6` 24px, `--space-8` 32px and `--space-12` 48px. Shared gaps and margins consume these tokens. Deliberate intermediate values include the 10px/18px button inset, 22–26px panel insets and 28px metric separation.

- **Above 1200px:** dashboard columns are 1.9:1 with a 24px gap; statistics form five columns. Setup/About are equal columns; Tip gives its form slightly more width.
- **At ≤1200px:** header spacing tightens and dashboard columns become 1.65:1.
- **At ≤1000px:** dashboard columns become 1.4:1, the wheel illustration sits above its readout, progress rows stack and statistics use three columns. Utility network text is omitted from the header; the chain remains visible in product data and Tip.
- **At ≤700px:** primary grids become a single column. Navigation moves to its own row and can wrap when text is enlarged. Main type becomes 32px and the block readout 48px. Statistics use two columns, with the final metric spanning both. The setup banner stacks its action. The wallet dialog becomes a bottom sheet. Wheel/readout groups wrap using rem-based flex bases, so enlarged text can stack them without collisions.
- **At ≤360px:** the wordmark, form rows and footer compact further. Primary controls remain reachable; labels and critical values wrap rather than ellipsize.

The normal overview and all five routes were checked at 320, 390, 700, 768, 1000, 1200 and 1440px. Enlarged text and an RTL mirror were also checked separately; they are not substitutes for a physical-device or browser-native zoom session.

## Elevation & Depth

Panels use a tonal background and one structural border, with no box shadow. Dividers separate activity rows and panel headers; spacing separates larger groups. Primary emphasis comes from a filled gold action rather than additional decoration.

The native wallet dialog enters the browser’s top layer, with a `#000a` backdrop and 4px backdrop blur. Toasts sit above the page at z-index 100. The transparent OBS widget uses nearly opaque dark surfaces to remain readable over a camera feed. The preview’s dotted background is not included in the OBS output.

## Shapes

Controls use `--radius-control: 8px`; panels use `--radius-panel: 12px`. The desktop wallet dialog uses 16px; on phones its top corners use 20px. Status indicators and category icons are circular; the small live badge is pill-shaped. Inputs and buttons have structural borders, while primary buttons use a solid fill.

## Components

| Component/pattern                                  | Source                              | Usage and states                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PageHeading`                                      | `web/src/ui.tsx`                    | `title`, `description`, optional action children. One h1 per normal page; stacks at mobile widths.                                                                                                                                                                                                                             |
| `Panel`                                            | `web/src/ui.tsx`                    | `title`, optional `icon`/`aside`, `className`, content children. Shared h2/header/body surface.                                                                                                                                                                                                                                |
| `.button`                                          | `web/src/styles.css`                | Neutral `.button-outline` or one primary `.button-primary` action. Hover, pressed, focus and native disabled states. Standard actions are at least 46px high; icon/header targets are at least 44px.                                                                                                                           |
| `WalletProvider`, `WalletControl`, `useOpenWallet` | `web/src/Wallet.tsx`                | Named EIP-6963 extensions, fallback browser wallet, Coinbase, and phone links. Native modal with explicit Tab/Shift+Tab cycling, Escape/backdrop close and trigger focus return. Pending row says Opening; errors stay in the sheet. Connected options expose the full address and Disconnect, including on the wrong network. |
| `WheelPanel`, `Status`, `Stats`                    | `web/src/Dashboard.tsx`             | Real API values, semantic progress elements and numeric readouts. Loading/Live/Stale/Offline labels. Missing readings stay as dashes. Current round is derived from the API’s genesis/duration and the browser clock.                                                                                                          |
| `Activity`                                         | `web/src/Dashboard.tsx`             | Five events initially; expand/collapse up to ten. Real transaction destinations. Loading, empty and retry states.                                                                                                                                                                                                              |
| `CopyButton`, notices                              | `web/src/ui.tsx`, `web/src/App.tsx` | Success only after clipboard write resolves; failure points to selectable text. Polite status region and dismissible messages; errors remain until dismissed.                                                                                                                                                                  |
| Setup fields                                       | `web/src/Setup.tsx`                 | Native labeled input/color/checkbox controls. Inline errors, invalid field focus, save feedback, local storage failure feedback and reset of the unsaved form.                                                                                                                                                                 |
| Tip form/review                                    | `web/src/Tip.tsx`                   | Presets use `aria-pressed`; decimal parsing is exact. Full recipient/token review, balance check, wrong-network/metadata pause, wallet pending, receipt pending, rejected, confirmed, reverted and unresolved states. An unresolved receipt blocks another send and offers a read-only recheck.                                |
| Stage/alert                                        | `web/src/Stage.tsx`                 | Same live widget in a preview canvas or transparent OBS mode. Test alerts and simulated demo tips are labeled. Sound controls affect the preview and copied overlay URL; Setup saves durable preferences. Demo preview can pause.                                                                                              |
| SVG identity/icons                                 | `web/src/graphics.tsx`              | Original hamster/brand/wheel drawing; one currentColor outline icon set. Decorative vectors are hidden from assistive technology. Official wallet marks remain in their native colors.                                                                                                                                         |

Focus uses a two-pixel visible outline; inputs use gold focus and two-pixel offset. Hover styling is gated to hover-capable devices. In `prefers-reduced-motion: no-preference`, buttons press to 0.96 scale with 150ms transitions; tip alerts enter once over 250ms; a pending spinner rotates. Reduced motion has no entrance/press animation or running spinner animation. There is no hero entrance, moving ticker or autoplay video.

## Do’s and Don’ts

Start a page with `PageHeading`, then the existing grid, `Panel`, fields and action classes. Keep an h1→h2→h3 outline. Use gold for its primary action and neutral surfaces for peers. Put directions next to the relevant control, and errors beside the field that can fix them.

Reuse the existing type roles, status vocabulary and spacing tokens. Keep addresses and transaction amounts complete in review states, and mark stale or simulated data explicitly. Keep custom overlay accents separate from standard interface text. Include new runtime assets locally and check their gateway paths after rebuilding.

Avoid extra type sizes, unverified counters, decorative label stacks, shadows on bordered panels and nested card surfaces. A new data source needs its own loading/failure behavior and a factual source description; it should not borrow a successful state from another source.

## Attribution

Better Interface design guidance: Jakub Krehel, MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. Documentation method: Paul Bakaus’s Impeccable, Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. Both license texts are retained in `web/design-guidance-LICENSE.txt`.
