# Design Spec: CLI Insights & Advanced Filtering

* **Date**: 2026-06-25
* **Author**: Antigravity
* **Status**: Approved
* **Target Workspace**: [qadrant](file:///Users/viardant/Code/qadrant)

---

## 1. Overview & Objective

To transition the Qadrant CLI from a simple local synchronization tool into a fully capable, agent-first and human-optimized analytical interface. This design defines advanced parsing utilities, improvements to the [handleList](file:///Users/viardant/Code/qadrant/cli/src/index.ts#L441) and [handleStats](file:///Users/viardant/Code/qadrant/cli/src/index.ts#L503) subcommands, and introduces a new `insights` subcommand.

---

## 2. Technical Specification

### 2.1 Parser & Helper Utilities

To support natural CLI input, we implement two core helper functions in [cli/src/index.ts](file:///Users/viardant/Code/qadrant/cli/src/index.ts):

#### A. Relative Date & Preset Parser
Parses user-friendly dates to normalized `YYYY-MM-DD` strings.
```typescript
function parseRelativeDateOrPreset(input: string): string {
  const normalized = input.trim().toLowerCase();
  
  if (normalized === 'today') {
    return new Date().toISOString().slice(0, 10);
  }
  if (normalized === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  
  const relativeMatch = normalized.match(/^(\d+)\s+(day|week|month)s?\s+ago$/);
  if (relativeMatch) {
    const count = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const d = new Date();
    if (unit === 'day') d.setDate(d.getDate() - count);
    if (unit === 'week') d.setDate(d.getDate() - count * 7);
    if (unit === 'month') d.setMonth(d.getMonth() - count);
    return d.toISOString().slice(0, 10);
  }

  // Fallback: Validate standard YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input)) {
    throw new CliError(`Invalid date format "${input}". Use YYYY-MM-DD, "today", "yesterday", or "N days/weeks/months ago".`);
  }
  return input;
}
```

#### B. Duration Parser
Parses strings like `5m`, `1.5h`, or `30s` into milliseconds.
```typescript
function parseDurationToMs(input: string): number {
  const match = input.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(s|m|h)$/);
  if (!match) {
    throw new CliError(`Invalid duration "${input}". Use shorthand formats like "30s", "5m", or "1.5h".`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  return 0;
}
```

---

### 2.2 Refinements to `list` Subcommand

The list command is updated to support:
* `--min-duration <dur>`: Omit short timers.
* `--ignore-spec`: Squash specializations into their spaces.
* `--dedup`: Group chronological records by local calendar day.

#### Argument Parsing Changes
Add the new flags to `PER_COMMAND_FLAGS`:
* `--min-duration`
* `--dedup` (boolean flag)
* `--ignore-spec` (boolean flag)

#### Execution Logic
Inside `handleList`:
1. Fetch time entries matching the query from the server.
2. Filter out entries where duration is less than `--min-duration` (if provided).
3. If `--ignore-spec` is active, map all entries' `specialization` to an empty string.
4. If `--dedup` is active:
   * Group entries by `(localDateString, space, specialization)`.
   * Sum the durations of entries in the same group.
   * Represent the result with date, sum duration, space, and specialization.

---

### 2.3 Refinements to `stats` Subcommand

We expand `stats` with additional grouping and period scopes.

#### A. Additional `--period` Presets
Extend period mapping to compute date ranges for:
* `yesterday`: Single day offset.
* `last-week`: Previous full Monday–Sunday range.
* `last-month`: Previous full calendar month.
* `last-30-days`: Trailing 30 days.

#### B. Additional Groupings (`--by`)
Extend client-side aggregation helper to support:
* `hour-of-day`: Map entries' start times to their hour components (0-23) and sum durations.
* `day-of-week`: Map entries' start dates to their weekday names (e.g. "Monday") and sum durations.

---

### 2.4 New `insights` Subcommand

Provides a structured summary of work trends and habits.

#### Execution Logic
1. Load entries for the requested period (defaulting to the last 30 days).
2. Calculate:
   * **Focus Blocks**: Sessions with duration $\ge 90$ minutes.
   * **Context Switches**: Average number of distinct shifts between `space` values on active days.
   * **Temporal Core**: Mean of start hour and mean of end hour across all sessions.
   * **Space Distribution**: Relative time ratio for each `space`.
   * **Velocity Trend**: active hours of the current week compared to the preceding week.

#### JSON Output Format
```json
{
  "period": {
    "from": "2026-05-26",
    "to": "2026-06-25"
  },
  "metrics": {
    "focus_blocks": 12,
    "avg_context_switches_per_day": 2.4,
    "temporal_core": {
      "avg_start": "09:12",
      "avg_end": "18:30"
    },
    "space_distribution": {
      "engineering": 0.72,
      "management": 0.18,
      "design": 0.10
    },
    "velocity_trend_percentage": 12.4
  }
}
```

---

## 3. Verification Plan

* **Unit Tests**: Add tests verifying:
  * Duration parsing with fractional values and multiple units.
  * Relative date preset parsing.
  * Deduplication algorithm on mock daily items (with and without specialization).
  * Grouping logic by `hour-of-day` and `day-of-week` in `stats`.
* **Integration Tests**: Verify end-to-end execution of `insights` with mock time entries.
