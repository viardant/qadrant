# Design Spec: Clarify DAILY_TREND_VECTORS Tooltip

## Purpose
The `DAILY_TREND_VECTORS` line chart currently shows two lines: the daily playtime of the current period and the rolling average baseline. Because the lines do not have names specified, Recharts displays them in the tooltip as `hours` and `() => stats.rollingAvg`. This is confusing. We want to label them clearly as `CURRENT` and `BASELINE` to clarify which value represents which concept.

## Proposed Changes
We will modify the lines in the `DAILY_TREND_VECTORS` line chart in `src/pages/Stats.tsx` to set descriptive `name` properties:
1. Solid line (representing current period's daily hours): `name="CURRENT"`
2. Dotted line (representing baseline): `name="BASELINE"`

## Impact & Testing
- There is no change in behavior or calculations, only in the rendering labels.
- Verify that the app compiles cleanly (`npm run build`).
- Verify that all tests pass (`npm run test`).
