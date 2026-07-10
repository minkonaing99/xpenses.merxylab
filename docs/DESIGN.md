# xpenses — UI/UX Design Brief

Token source: root `/DESIGN.md` (installed via `npx getdesign@latest add apple`
— Apple.com marketing-page design system). **Tokens only** — colors,
typography scale, spacing, radii, and shadow/press-state philosophy carry over.
Marketing components (product tiles, configurator chips, hero photography
layouts) do NOT — xpenses uses new, app-native components built from the same
tokens (see Component Inventory below).

## Design Goals
Fast, legible, calm, trustworthy, uncluttered — a solo-use money ledger should
feel like a precise tool, not a marketing page. Every screen optimizes for
"add an expense in under 5 seconds."

## Target Devices + Breakpoints
Mobile-first, installable PWA. Primary target: phone viewport (~375-430px).
Usable on tablet/desktop as a secondary case (single-column layout scales up
with max-width centering; no dedicated desktop layout in v1).

## Color System
Sourced from root `DESIGN.md` `colors` block:
- Primary / interactive: `#0066cc` (primary), `#0071e3` (focus state).
- Ink / body text: `#1d1d1f`.
- Canvas (app background): `#f5f5f7` (canvas-parchment) for light mode.
- Surfaces (cards, sheets): `#ffffff` (canvas) on `#f5f5f7` background;
  dark-mode tile surfaces `#272729` / `#2a2a2c` / `#252527` reused for dark theme.
- Muted text: `#7a7a7a` (ink-muted-48), `#333333` (ink-muted-80).
- Dividers/hairlines: `#f0f0f0`, `#e0e0e0`.
- Semantic (new, not in source token set — needed for money UI):
  - success/income: `#1d8a3e` (green, on-brand-adjacent, not from Apple set).
  - warning/budget-over: `#d9822b`.
  - error/destructive: `#d70015` (Apple system-red equivalent).
  - info: `primary` (`#0066cc`).

## Typography
SF Pro Display (headings) / SF Pro Text (body), per root `DESIGN.md`
`typography` block. App usage mapping:
- Screen titles: `display-md` (34px/600).
- Section headers (e.g. "This Month"): `tagline` (21px/600).
- Amount display (large, e.g. balance card): custom `amount-lg` — 32px/700,
  tabular-nums (new, not in source set — money needs monospaced digits for
  column alignment; source set has no numeric-specific style).
  - Sizes for h1-h6 + body + caption:
    - h1: `display-lg` 40px/600
    - h2: `display-md` 34px/600
    - h3: `lead` 28px/400
    - h4: `tagline` 21px/600
    - h5: `body-strong` 17px/600
    - h6: `caption-strong` 14px/600
    - body: `body` 17px/400
    - caption: `caption` 14px/400

## Spacing System
8px-ish base scale from root `DESIGN.md` `spacing` block: `xxs` 4px, `xs` 8px,
`sm` 12px, `md` 17px, `lg` 24px, `xl` 32px, `xxl` 48px. (`section` 80px is
marketing-only, not used in app screens.)

## Component Inventory (app-native, built from tokens)
- `Button` — primary (pill, `rounded.pill`, `scale(0.95)` press), secondary
  (outline), destructive (red text/border).
- `Card` — `rounded.lg` (18px), single-shadow discipline (subtle, not the
  marketing product-shadow), used for balance/summary cards.
- `Field` — text/number input with label, used in TxnForm.
- `Chip` — category picker, `rounded.pill`, selected state = primary bg.
- `BottomTabBar` — 4 tabs (Transactions, Reports, Budgets, Settings).
- `TxnRow` — list row: icon/category, note, amount (colored by type), date.
- `AmountInput` — numeric keypad-friendly satang input with THB formatting.
- `Banner` — budget-over alert, warning-colored, dismissible per session.
- `Sheet`/`Modal` — TxnForm presentation on mobile.
- `Skeleton` — loading placeholder for list rows and cards.

## Interaction Patterns
- Press state: `transform: scale(0.95)` on buttons/chips/rows (per root
  DESIGN.md press-state convention).
- Transitions: short (150-200ms) ease-out on sheet open/close, banner
  show/hide. No decorative animation.
- Loading skeletons: shown for list/card content while Dexie cache hydrates
  or a network fetch is in flight (see PRD.md App Flow state transitions).
- Toasts: not used — inline banners and optimistic UI cover feedback needs
  without a separate toast system.

## Accessibility
WCAG AA minimum: 4.5:1 text contrast (verify `#7a7a7a` muted text against
`#f5f5f7`/`#ffffff` — acceptable for secondary text at 14px+ per AA large-text
allowance, avoid for body-critical text under 14px). Full keyboard nav for
desktop/browser use (tab order through forms, Enter to submit). Screen reader
labels on all icon-only controls (FAB, tab bar icons). Minimum 44px touch targets.

## Icon Set
Resolved: Phosphor (`@phosphor-icons/react`), `weight="fill"` for filled
states / `regular` otherwise, matching the implemented design-bakeoff winner.
No custom icon set — solo-use utility app doesn't need brand-specific glyphs.

## Dark Mode
Optional, not required for v1. Root DESIGN.md's dark tile surfaces
(`#272729`/`#2a2a2c`/`#252527`) are reserved as the dark-mode palette if/when
implemented — not built in the initial pass.

## Design Reference Links
- Token source: root `/DESIGN.md` (Apple.com marketing-page analysis, via
  `getdesign` CLI).
- No Figma/screenshots yet — TBD.
