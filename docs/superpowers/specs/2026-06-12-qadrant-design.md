# Design Specification: qadrant - Time Tracker & Analytics System

## 1. Overview & Goals
**qadrant** is a modern, high-fidelity, multi-tenant time tracking application with integrated charting features. It is a complete revamp and combination of two existing tools: `notion-tt` (timer tracker) and `notion-tt-charter` (charts & analytics). 

### Key Objectives
* **Unified Tooling**: Replace the dual-system architecture (Express + Notion + SQLite) with a client-only Vite + React SPA backed by a PocketBase BaaS instance.
* **No Notion Integration**: PocketBase is the sole database and source of truth. Time logs are written and read directly from PocketBase.
* **Terminal-Inspired Aesthetics**: Leverage the typographic split, color palette, typewriter animations, and layout patterns from the terminal-styled `piano-sheet-notion`.
* **Developer Ecosystem**: Provide a standalone Node-based CLI and an MCP Server so AI coding agents can interact with the tracker.

---

## 2. System Architecture

```
                                  ┌────────────────────────┐
                                  │      PocketBase        │
                                  │   BaaS Cloud Instance  │
                                  └───────────┬────────────┘
                                              │ (HTTPS/WebSockets)
                 ┌────────────────────────────┼────────────────────────────┐
                 ▼                            ▼                            ▼
      ┌─────────────────────┐      ┌────────────────────┐      ┌───────────────────────┐
      │  Vite + React SPA   │      │     CLI Tool       │      │      MCP Server       │
      │  (Client Frontend)  │      │      (qadrant)        │      │   (qadrant-mcp tool)     │
      └─────────────────────┘      └──────────┬─────────┘      └───────────┬───────────┘
                                              │                            │
                                              └─────────────┬──────────────┘
                                                            ▼
                                                    Reads/Writes config
                                                   `~/.qadrant/config.json`
```

### Components
1. **React Web SPA**: Client-side single-page app hosted on serverless static hosting (e.g., Vercel / Cloudflare Pages). Communication is 100% direct with PocketBase.
2. **PocketBase BaaS**: Handles auth, security rules, and data persistence.
3. **CLI (`qadrant`)**: Command line interface for starting/stopping/viewing timers. Saves local credentials.
4. **MCP Server**: Stdio-based Model Context Protocol server allowing LLMs to log developer hours in real-time.

---

## 3. Data Schema (PocketBase)

### Collection: `users` (System Auth)
* **Custom Fields**:
  * `space_colors` (json, optional) — Maps top-level Space names to hex colors.
    * Example: `{"Work": "#35675d", "Piano": "#ba1a1a", "qadrant": "#000000"}`
* **API Rules**:
  * List, View, Update: `id = @request.auth.id`
  * Create, Delete: locked (handled by Google OAuth2 registrar)

### Collection: `time_entries` (Base)
* **Fields**:
  * `id`: text (system key)
  * `user`: relation to `users` (required, single, cascade delete)
  * `task`: text (required) — Name of activity (e.g., "Designing schema")
  * `space`: text (optional) — Top-level categorization (e.g., "Work")
  * `specialization`: text (optional) — Sub-level specialization (e.g., "Client A")
  * `start_date`: date (required) — ISO timestamp of start
  * `completion_time`: date (optional) — ISO timestamp of stop (null if timer is active)
  * `completed`: bool (required) — Defaults to `false`
* **Indexes**:
  * Index on `(user, start_date)` for query performance.
* **API Rules**:
  * List, View, Create, Update, Delete: `user = @request.auth.id`

---

## 4. UI & Layout Design (Web SPA)

### Typography & Colors
* **Fonts**:
  * Headers, tags, statuses, monospace numbers: **`Space Grotesk`**
  * Body copy, lists, settings forms, tooltips: **`Inter`**
* **Palette**:
  * Background: `#fdf8f8` (warm rose-white)
  * Primary Ink: `#1c1b1c` (soft charcoal black)
  * Accent (Brand): `#35675d` (muted forest green)
  * Error: `#ba1a1a` (crimson red)
  * Warning: `#f59e0b` (amber)
  * Outlines: `rgba(28, 27, 28, 0.1)` (charcoal outline)

### Layout Pages (Bottom Nav Navigation)
* **`/login`**: Clean terminal login. Contains a single `"CONNECT_GOOGLE_ACCOUNT"` button and callback animation loader `"COMPLETING_SIGN_IN_PROTOCOL..."`.
* **`/` (Logger)**:
  * *Unified Input*: Text input for task name + Space / Specialization autocomplete combo-boxes (inline additions are created on-the-fly without friction).
  * *Active Timer Screen*:Monospace timer showing `hh:mm:ss` with ticking separator colon and a large `STOP_SESSION` button.
  * *Quick Start Cards*: Dynamic grid showing 4–6 of the user's most recent Space + Specialization combinations. Clicking a card starts a timer pre-populated with those values.
* **`/charts` (Dashboard)**: Curated Recharts dashboard featuring:
  1. *Weekly Stacked Bar*: Daily hours grouped by week and stacked by Space.
  2. *Monthly Stacked Bar*: Daily hours grouped by month and stacked by Space.
  3. *Space Donut*: Cumulative time percentage across Spaces.
  4. *Daily Trend*: Line graph showing total tracked hours per day.
  5. *Calendar Heatmap*: D3/Grid consistency display showing activity intensity.
* **`/ledger` (History)**: Flat tabular log listing historical entries with options to delete or modify past timer entries (task, space, sub-level, start/stop times).
* **`/settings`**: Personalization pane allowing custom hex assignments for Spaces, token generation for CLI access, and sign-out.

---

## 5. Authentication (Manual Exchange OAuth)

To support mobile browsers (Safari) and avoid popup block errors, we utilize a full-tab redirect PKCE manual exchange flow:

1. **Initiate redirect** (in `/login`):
   * App requests provider details from PocketBase: `pb.collection('users').listAuthMethods()`
   * Saves Google provider's `name`, `codeVerifier`, and `state` to `sessionStorage`.
   * Redirects tab: `window.location.href = googleProvider.authURL + encodeURIComponent(window.location.origin + '/login')`
2. **Exchanging Code** (in `/login` callback):
   * Component reads `code` and `state` parameters from URL query.
   * Matches `state` against `sessionStorage` value (CSRF security).
   * Swaps code: `pb.collection('users').authWithOAuth2Code('google', code, verifier, redirectUrl)`
   * Cleans up `sessionStorage` immediately.
   * Sets `pb_auth` cookie and redirects to `/`.

---

## 6. CLI Integration (`qadrant`)

* **Package**: Locally publishable npm executable (`qadrant-cli`).
* **Config File**: Reads/writes credentials to `~/.qadrant/config.json`.
* **Commands**:
  * `qadrant login <token>`: Authenticates using the web-generated token.
  * `qadrant start "<task>" [--space <space>] [--sub <specialization>]`: Starts a new session. Closes active timers first.
  * `qadrant stop`: Stops the current session.
  * `qadrant status`: Returns elapsed time and task name for active timers.
  * `qadrant list [--limit <n>]`: Prints a table of recent sessions.
  * `qadrant stats`: Prints tracked hours by timeframe.

---

## 7. MCP Server Integration (`qadrant-mcp`)

### Best Practice Compliance
* **Language/Transport**: Node.js + TypeScript SDK, running over standard I/O (`stdio`).
* **Session Sharing**: Reuses `~/.qadrant/config.json` written by the CLI to authenticate PocketBase requests.
* **Zod Schemas**: Every tool defines strict parameters and descriptions with examples to help LLM clients form correct arguments.

### Exposed Tools
* `qadrant_start_timer` (idempotent: false, readOnly: false)
  * Schema: `{ task: string, space?: string, specialization?: string }`
  * Action: Starts a new active timer, stopping any current timer first.
* `qadrant_stop_timer` (idempotent: false, readOnly: false)
  * Schema: `{}`
  * Action: Stops the currently active timer.
* `qadrant_get_active_timer` (idempotent: true, readOnly: true)
  * Schema: `{}`
  * Action: Returns active timer details or null.
* `qadrant_list_entries` (idempotent: true, readOnly: true)
  * Schema: `{ limit?: number }`
  * Action: Lists the most recent timer logs.
* `qadrant_get_stats` (idempotent: true, readOnly: true)
  * Schema: `{ timeframe?: string }`
  * Action: Returns aggregated statistics for LLM reporting.
