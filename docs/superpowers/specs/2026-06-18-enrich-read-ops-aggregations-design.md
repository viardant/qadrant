# Design Specification: Enrich CLI / MCP Read Operations with Aggregations

**Date:** 2026-06-18
**Status:** Approved (proceeding to plan)
**Scope:** `cli/` and `mcp-server/` packages, in lockstep.

## 1. Goal & non-goals

### Goal

Add first-class aggregation primitives to the CLI and MCP server so the agent (and a human in the terminal) can answer questions like:

- "How many hours did I spend on `Work` this month?"
- "What is my distribution across spaces this week?"
- "How many sessions did I run per day last month?"

…without the agent having to fetch raw entries and compute on the fly. The SPA already does this work in `src/lib/transform.ts`; the read-side surfaces (CLI/MCP) currently only expose a single `total tracked hours` number and a flat `list` of recent entries.

### Non-goals (YAGNI for this round)

- **New KPIs** (streak, mastery, best day, top combos, etc.). They are pure derived numbers; if the user wants them, we add them on the same surface in a follow-up.
- **Custom date ranges** (`--since` / `--until`). Preset windows only.
- **Filtering by `space` / `specialization` on aggregations.** Group-by only.
- **Extending the `list` command.** The user picked `aggregate` + `stats` extension; `list` stays as-is.
- **A shared `packages/qadrant-stats/` workspace.** Per the user's call, each surface keeps its own copy of the aggregation logic.

## 2. Group-by dimensions

Five values for `--by`, mirroring the SPA conventions exactly.

| `--by` | Group key | Mirrors SPA |
| --- | --- | --- |
| `space` | `entry.space` (empty → `"No Space"`) | `transformToSpaceDistribution` |
| `combo` | `comboDisplayName(space, specialization)` | `deriveTopCombos` shape |
| `day` | local `YYYY-MM-DD` of `start_date` | `transformToDailyTrend` |
| `week` | local Monday `YYYY-MM-DD` of `start_date` | `getLocalWeekMondayString` + `transformToWeeklyData` |
| `month` | `YYYY-MM` of `start_date` | `getLocalMonthString` + `transformToMonthlyData` |

The same local-time date helpers used by the SPA are mirrored in each surface. (See §8.)

## 3. Time windows (periods)

Four preset values for `--period`, applied against `entry.start_date`.

| `--period` | Filter |
| --- | --- |
| `today` | local date == today |
| `this-week` | local Monday == this week's Monday |
| `this-month` | `YYYY-MM` == this month |
| `all` | no filter |

**Default is `all`** to preserve the current CLI behavior.

## 4. Per-group metrics

For every group, compute:

- `hours` — sum of `(completion_time − start_date)` over **completed** entries in the group, decimal hours, 2dp.
- `sessions` — count of completed entries in the group.
- `share` — `hours / total_hours_in_window`, 4dp fraction, `0` when the total is 0.

**Active entries** (no `completion_time`) are excluded from `hours` and `sessions`, but their `start_date` still gates the period filter. This matches the existing `stats` and `list` behavior.

## 5. CLI command surface

```
qadrant aggregate --by <space|combo|day|week|month>
                  [--period <today|this-week|this-month|all>]
                  [--format <text|json>]

qadrant stats    [--by <space|combo|day|week|month>]
                  [--period <today|this-week|this-month|all>]
                  [--format <text|json>]
```

- `qadrant aggregate` always emits a grouped table. New top-level command. **Requires `--by`**.
- `qadrant stats` without `--by` keeps the current single-number output (`TOTAL_TRACKED_HOURS: 12.34`). With `--by`, it produces the same shape as `aggregate`. **Backward compatible.**
- `--format` defaults to `text`. `json` emits the structured payload (see §7).
- The `options` object in `parseArgs` widens to include `by?: string`, `period?: string`, `format?: string`. Validation happens in each command branch.

### Text output shape

```
DIMENSION: SPACE
PERIOD:    THIS_MONTH
WINDOW:    2026-06-01..2026-06-30
─────────────────────────────────────────────
KEY                HOURS   SESSIONS  SHARE
Work               12.34          8   64.2%
Piano               4.21          5   21.9%
qadrant             2.65          3   13.8%
─────────────────────────────────────────────
TOTAL              19.20         16  100.0%
```

- Sort: `hours` desc, then `key` asc (stable).
- Empty `space` is rendered as `No Space` in the table; empty `specialization` is rendered as `Untitled` for the `combo` dimension.
- Width is computed from the longest key in the result; we cap at 32 chars per key column to keep the table readable.

## 6. MCP surface (lockstep with CLI)

| MCP tool | Change | Args |
| --- | --- | --- |
| `qadrant_aggregate` | **new** | `by` (required, enum), `period` (enum, default `all`), `response_format` (markdown/json, default markdown) |
| `qadrant_get_stats` | extends | add `by` (optional enum), `period` (enum, default `all`) |

- `qadrant_aggregate` always returns the grouped shape.
- `qadrant_get_stats` without `by` returns the legacy single-number shape (`total_hours`, `session_count`, `overall_count`) so existing MCP consumers keep working.
- `qadrant_get_stats` with `by` returns the grouped shape.
- The text payload for both tools uses the same DIMENSION/PERIOD/WINDOW/KEY/HOURS/SESSIONS/SHARE/TOTAL block as the CLI.

## 7. JSON schema (both surfaces)

```json
{
  "by": "space",
  "period": "this-month",
  "window": { "start": "2026-06-01", "end": "2026-06-30" },
  "rows": [
    { "key": "Work",  "hours": 12.34, "sessions": 8, "share": 0.6421 },
    { "key": "Piano", "hours":  4.21, "sessions": 5, "share": 0.2193 },
    { "key": "qadrant", "hours": 2.65, "sessions": 3, "share": 0.1386 }
  ],
  "total": { "hours": 19.20, "sessions": 16 }
}
```

- When `period == "all"`, `window` is `null`.
- `share` is a fraction in `[0, 1]`, not a percentage.
- `hours` is rounded to 2 decimal places. `share` to 4.

## 8. Architecture / file layout

Per the user's call, **mirror the aggregation logic in each surface** (no shared package, no path aliases, no `tsconfig` changes).

### CLI (`cli/src/`)

- **NEW** `aggregate.ts` — exports:
  - `aggregateBy(config, opts: { by, period })` → returns `{ by, period, window, rows, total }`.
  - `formatAggregateText(result)` → returns the table string.
  - `formatAggregateJson(result)` → returns the JSON string.
  - Internal helpers: `filterByPeriod(entries, period)`, `groupBy(entries, by)`, and the four date helpers mirrored from `src/lib/transform.ts`.
- **EDIT** `index.ts` — wire the `aggregate` command; extend the `stats` command to accept the new flags. No architectural rewrite.
- **EDIT** `index.test.ts` — add unit tests for `aggregate.ts` (filter, group, format, JSON shape). The existing `vi.mock('fs/promises')` harness is extended to stub `fetch` so we can test the full command path.

### MCP (`mcp-server/src/`)

- **NEW** `tools/aggregate.ts` — same shape as the CLI's `aggregate.ts`, but uses the MCP's `apiCall` helper. Mirrors the local-time date helpers from `transform.ts`.
- **EDIT** `tools/stats.ts` — extend with `by` / `period` branches. The legacy "no-by" path stays as the default return shape.
- **EDIT** `schemas.ts` — add `AggregateSchema`; extend `GetStatsSchema` with `by` and `period`.
- **EDIT** `index.ts` — register `qadrant_aggregate`; update the `qadrant_get_stats` description to mention the new args.
- **EDIT** `index.test.ts` — add coverage of the new tool, plus a regression test that the no-args `qadrant_get_stats` still returns the legacy shape.

### Drift

Each surface keeps its own copy of the four small helpers (`getLocalDateString`, `getLocalWeekMondayString`, `getLocalMonthString`, `getEntryDurationHours`). We accept the drift risk; a follow-up can extract a shared package if the duplication becomes painful.

## 9. Error handling

| Case | CLI exit | Message |
| --- | --- | --- |
| Unknown `--by` | 1 | `ERROR: --by must be one of space|combo|day|week|month` |
| Unknown `--period` | 1 | `ERROR: --period must be one of today|this-week|this-month|all` |
| `--format` not `text`/`json` | 1 | `ERROR: --format must be text|json` |
| `aggregate` without `--by` | 1 | `ERROR: --by is required for aggregate` |
| No completed entries in window | 0 | Empty `rows: []`, `total.hours: 0`, `total.sessions: 0` (table renders a `NO_DATA` row) |

MCP equivalents return `isError: true` with the same message text in the `content` block, plus the structured `status: "invalid_input"` envelope in `structuredContent` (the `handleApiError` pattern is already in place; we extend it with a tiny `handleInputError` for non-API validation).

## 10. Testing strategy

- **CLI unit tests** (`cli/src/index.test.ts` + new `aggregate.test.ts`):
  - `filterByPeriod` — one test per period, plus `all` and an empty-window case.
  - `groupBy` — one test per `by` value, including empty `space` (→ `"No Space"`) and empty `specialization` (combo still produces a key).
  - `formatAggregateText` — golden-string snapshot for one canonical input.
  - `formatAggregateJson` — golden-JSON snapshot.
  - End-to-end via Vitest with the existing `vi.mock('fs/promises')` harness extended to stub `fetch` (the current tests only cover `parseArgs` / config).
- **MCP unit tests** (`mcp-server/src/index.test.ts` + new `aggregate.test.ts`):
  - Same coverage of filter / group / format.
  - Verify the existing `qadrant_get_stats` no-args path still returns the legacy shape (regression).

## 11. Out of scope / future

- Raw `range` query: "give me the entries in window X" — add when the agent needs to drill down past the aggregated view.
- Filter by `space` / `specialization` on aggregations.
- Custom date ranges (`--since` / `--until`).
- New KPIs (streak, mastery, top combos, best day, mastery index) — these are pure derived numbers; they slot into the same JSON envelope.
- A `packages/qadrant-stats/` shared module if the three-surface drift becomes a problem.

## 12. Acceptance checklist

- [ ] `qadrant aggregate --by space` (default period `all`) produces a sorted table summing to the same total as `qadrant stats`.
- [ ] `qadrant aggregate --by day --period this-week` returns 0–7 rows for the current local week.
- [ ] `qadrant aggregate --by combo --period this-month --format json` parses as the schema in §7.
- [ ] `qadrant stats` (no flags) still prints `TOTAL_TRACKED_HOURS: 12.34` and nothing else.
- [ ] `qadrant stats --by space --period today --format json` produces the same JSON envelope as `qadrant aggregate`.
- [ ] `qadrant_aggregate` MCP tool returns the §7 envelope.
- [ ] `qadrant_get_stats` MCP tool with no `by` returns the legacy single-number shape (regression).
- [ ] All four error cases in §9 produce the documented exit code + message.
- [ ] Unit tests for CLI and MCP cover filter / group / format / JSON for every `by` and `period` combination.
