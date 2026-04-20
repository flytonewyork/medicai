# Internationalisation Guide

## Languages

- English (`en`) — default
- Simplified Chinese (`zh`) — primary for Hu Lin

## Implementation

`next-intl`, with messages in `public/locales/<lang>/common.json` and a provider
at the root layout. Locale is persisted in `settings.locale` and the Zustand UI
store.

## Scope

Translated:
- All patient-facing strings (daily, weekly, assessments)
- All error and confirmation messages
- Zone names, recommendations, alerts
- Navigation, buttons, labels

Not translated (remain English):
- Clinical terminology in reports for Dr Lee (ECOG, CA19-9, etc.)
- Trial IDs (RASolute 303, NCT07491445)
- Drug names (daraxonrasib, gemcitabine, nab-paclitaxel) — Chinese in
  parentheses on first use

## Cultural considerations

- Family-name-first convention in Chinese
- Date format: YYYY年MM月DD日 (zh), DD/MM/YYYY (en, AU)
- Keep authentic practice terminology (禅修 / 气功) — do not translate into
  Western equivalents
