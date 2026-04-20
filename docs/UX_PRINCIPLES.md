# UX Principles

## Tone

Measured, respectful, honest. This is not a consumer wellness app. No emoji, no
gamification, no celebratory streaks. Hu Lin has metastatic cancer. He deserves
interface respect.

## Typography

- Large type for primary inputs (18px minimum on mobile)
- High contrast (WCAG AAA where feasible)
- Chinese typography: Noto Sans SC / PingFang SC / Microsoft YaHei, not Latin
  fonts with CJK fallback

## Colour

Zone colours are functional, not decorative:
- Green zone: slate-500 (deliberately muted)
- Yellow zone: amber-500
- Orange zone: orange-600
- Red zone: red-700

Baseline UI: neutral greys with minimal accent colour.

## Information density

- Daily tracking: low density, single-focus per screen on mobile
- Dashboard: denser for Thomas, calmer for Hu Lin (role-aware later)
- Reports: clinical density, optimised for printing

## Interaction

- Daily check-in: step-through wizard on mobile
- Confirmation required for deletions, zone acknowledgements, decision entries
- No confirmations for routine saves, navigation

## Errors

- Never blame the user
- Always provide a recovery path
- Auto-save every field — connection loss should never cost data
- Show trust signals (last-saved timestamp, "local only" badge)

## Accessibility

- Full keyboard navigation
- Screen reader support
- Large tap targets (48×48 minimum)
- Colour never the sole signal (zone badges have text + icon + colour)
- Language switcher always visible
