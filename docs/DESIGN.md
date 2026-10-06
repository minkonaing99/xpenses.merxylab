# xpenses - UI/UX Design Brief

Source of truth for values: `web/src/theme/tokens.css`. This brief describes
intent; change tokens there, not here. Frontend architecture lives in
[WEB.md](WEB.md).

## Design Goals

Calm, trustworthy, fast, private, tactile.

- Money is the content: figures use tabular, lining numerals and never shift
  width when they change.
- One violet accent for the primary action and active state. Money sign uses
  muted green/red tints, never the brand color.
- Single owner: no onboarding, sharing, or role UI.

## Target Devices + Breakpoints

Mobile-first installable PWA, also used on iPad and desktop.

| Context | Layout |
|---|---|
| Phone, iPad portrait | Labeled bottom tab bar, bottom sheets |
| iPad landscape, desktop | Expanded sidebar, right-side sheets |

Supported reference viewports: 390x844 (phone), 744x1133 and 1133x744 (iPad
mini), 1440x900 (desktop). Safe-area insets applied on all four edges
(`--safe-t/r/b/l`). Primary touch targets are at least 44px.

## Color System (OKLCH, neutrals tinted toward hue ~292)

| Role | Token | Light | Use |
|---|---|---|---|
| Background | `--paper` | 0.975 0.007 292 | App canvas |
| Raised | `--paper-raised` | 0.995 0.004 292 | Cards, sheets |
| Sunken | `--paper-sunken` | 0.955 0.011 292 | Inset fields, tracks |
| Text | `--ink` / `--ink-soft` / `--ink-faint` | 0.26 / 0.48 / 0.64 | Primary / secondary / tertiary |
| Lines | `--line` / `--line-strong` | 0.925 / 0.86 | Dividers / field borders |
| Primary (accent) | `--accent` | 0.55 0.21 288 | FAB, active tab, primary fill |
| Accent support | `--accent-press`, `--accent-wash`, `--accent-soft` | | Pressed, washes, chips |
| Hero gradient | `--grad-from` to `--grad-to` | 288 to 300 hue | Balance hero card |
| Success / income | `--pos`, `--pos-wash` | 0.60 0.15 155 | Positive money |
| Error / expense | `--neg`, `--neg-wash` | 0.58 0.20 22 | Negative money |
| Danger | `--danger`, `--danger-wash` | 0.57 0.21 22 | Over budget, destructive |
| Focus | `--focus` | 0.55 0.18 288 | Focus rings and underlines |
| Categories | `--cat-a` to `--cat-h` | 8 hues | Category icon tiles via `categoryColor()` |

No separate warning/info palette exists; anomaly and over-budget states use
`--danger` and the accent washes.

## Typography

- Font: native system stack (`--font-ui`). No web fonts.
- Numbers: `--num` enables tabular + lining figures for all money.
- Scale (~1.25, matched to iOS):

| Token | Size | Use |
|---|---|---|
| `--t-hero` | 34px | Amount entry, large title |
| `--t-figure` | 28px | Balances, key figures |
| `--t-title` | 20px | Screen and sheet titles |
| `--t-lead` | 17px | Emphasized body |
| `--t-body` | 15px | Body |
| `--t-label` | 13px | Labels, chips |
| `--t-caption` | 12px | Captions, meta |

## Spacing, Radii, Elevation, Motion

- Spacing: `--sp-1` 4px, `--sp-2` 8px, `--sp-3` 12px, `--sp-4` 16px,
  `--sp-5` 24px, `--sp-6` 32px, `--sp-7` 48px.
- Radii: `--r-sm` 10px, `--r-md` 16px, `--r-lg` 24px, `--r-xl` 28px,
  `--r-full` pill.
- Elevation: `--shadow-1` (rows), `--shadow-2` (cards), `--shadow-accent`
  (FAB), `--shadow-sheet` (sheets). Shadows are violet-tinted.
- Motion: `--dur-1` 120ms, `--dur-2` 220ms, `--dur-3` 360ms with
  `--ease-out` / `--ease-out-soft`. Entrance animation via GSAP
  (`lib/motion.ts`, `useEntrance`), skipped when motion is reduced.

## Component Inventory (`web/src/ui/`)

| Component | Purpose |
|---|---|
| `Button` | Primary, ghost, quiet variants |
| `Money`, `AnimatedMoney` | Formatted THB with sign tint, animated changes |
| `MoneyInput` | Baht entry, converts to satang |
| `Select`, `Segmented` | Pickers; Segmented is an arrow-key radio group |
| `Sheet` | Bottom sheet / right drawer dialog with dirty-draft guard |
| `MonthSwitcher` | Shared month navigation |
| `PageHeader` | Title, back link, action slot |
| `Donut`, `Sparkline` | Category split and trend charts |
| `Logo` | Brand mark |

Feature screens compose these; shared form styles live in `ui/form.css`.

## Interaction Patterns

- Sheets animate in from the bottom (side on wide screens); backdrop tap,
  close button, or Escape closes; unsaved drafts ask before discarding.
- Loading: mostly inline "Loading..." notes; Savings pots uses a skeleton
  block. Errors use `role="alert"`.
- Writes are offline-resumable; the global sync banner shows queued,
  sending, and failed writes (see WEB.md).
- No toast system; feedback appears inline or in the sync banner.

## Accessibility

- Target: WCAG 2.2 AA.
- Global `:focus-visible` ring (`--focus`); borderless inputs get a focus
  underline instead.
- Keyboard: sheets trap focus and restore it on close; single-key shortcuts
  `n`, `/`, `[`, `]`, `?`; Ledger rows move with Up/Down or `j`/`k`
  (details in WEB.md "Keyboard").
- Icon-only controls carry `aria-label`; decorative SVGs are `aria-hidden`.
- Money sign is never conveyed by color alone (signed amounts).

## Icons

Inline SVG line icons (24px viewBox, ~1.9 stroke, round caps), drawn in
components. No icon library.

## Dark Mode

Implemented. `:root[data-theme="dark"]` overrides every token; the choice is
device-local (`xpenses.theme.v1`) and restored by a pre-paint script in
`index.html` to avoid a flash.

## Design References

TBD. No Figma file; the current UI came from a two-variant bake-off
("Quiet Card System" won, see PLAN.md history).
