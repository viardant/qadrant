# Product

## Register

product

## Users

A solo developer tracking their own work time. The human is the only writer of time entries — they start and stop timers, edit past entries, configure their workspace, and review their own data. The second user is an AI agent (Claude or compatible) that interacts with the same data through the `qadrant` CLI and the `qadrant-mcp` MCP server, primarily to *read* entries and produce analysis. The agent is a co-equal reader but never an autonomous writer; the human is the source of truth for what was worked on.

Context: the human is mid-work when they interact with the writing UI (one-handed, distracted, in flow). The agent interacts asynchronously, in a separate terminal or chat, and benefits from a structured, parseable schema. The two surfaces never conflate: the SPA is for the human in motion, the CLI/MCP is for the agent in conversation.

## Product Purpose

A personal, agent-readable time-tracking system. The human logs work as it happens; an AI agent can read the same log and produce grounded analysis ("how much time did I spend on X last month?", "where did my hours actually go this quarter?"). The product exists to close the loop between a human's lived work and an agent's ability to reason about it — without the human having to hand-curate a summary every time they want a question answered.

Success looks like: the human can have a real conversation with an agent about how their time is spent, the agent's answers are grounded in ground-truth data the human trusts, and the act of logging work is invisible enough that the human does it consistently.

## Brand Personality

**Three words: obsessive, opinionated, intimate.**

The product reads like a measurement device the user built for themselves — not a generic SaaS dashboard, not a productivity app, not a corporate time-tracker. Voice is terminal-editorial, diagnostic, slightly clinical but human: the kind of UI that takes its subject (your time) seriously enough to be quiet about it. Typography does the work that marketing copy usually does. The system is opinionated about defaults; the user is expected to adopt the model's vocabulary, not negotiate a friendly one.

The intimacy comes from this being a personal instrument. There is no "team dashboard", no "share your week", no leaderboard. The user is talking to themselves — and to an agent they trust — about their own hours. The product should feel like the inside of that conversation, not a public-facing product surface.

## Anti-references

What qadrant explicitly should NOT look or feel like:

- **Corporate time tracking** (Harvest, Clockify, Toggl Track) — too neutral, too business, no instrument feel. The product is personal, not billable.
- **"Calm productivity app" family** (Notion, Things, Headspace) — too soft, no measurement identity, no relationship with raw data. The user is here to be told the truth, not to be soothed.
- **Wellness-aesthetic quantified self** (Oura, Whoop, Apple Health) — passive, no agency, designed to be read at you rather than with you.
- **Gamified habit trackers** (Streaks, Habitica) — coercive loops, streaks-as-shame. The product is a measurement device, not a coach.
- **Generic SaaS dashboards** (Tailwind admin templates, gradient SaaS hero patterns) — those read as "demoed for a sales team", not as "built for me". The system is too editorial for that shape.
- **Friendly or chatty copy patterns** ("Hi there! Let's get started…", "Powerful", "Beautiful", "Easy to use") — diagnostic, not promotional. The vocabulary is `PROTOCOL` / `ARCHIVE` / `MASTERY`, not "onboarding flow".
- **"AI copilot" framing** — the agent is a reader, not a co-pilot. The human drives; the agent analyses.

## Design Principles

1. **Human writes, agent reads.** The writing UI is for the human in flow (one-handed, distracted, fast). The data schema is for the agent to query (structured, stable, parseable). The two never conflate: the SPA optimizes for the human's time-to-log; the CLI/MCP optimizes for the agent's time-to-answer.
2. **Ground truth over interpretation.** The product records what happened. Analysis is the agent's job, not the UI's. The dashboard surfaces data; it does not editorialize on it.
3. **Measurement device, not coach.** The product tells the user what they did. It does not tell them what they should do. No streaks-as-shame, no goals-as-guilt, no nudges.
4. **Personal instrument, not shared product.** Reads like a tool the user built for themselves. No "team" features, no "share" affordances, no social layer. The product is intimate; the audience is the user and their agent.
5. **Agent parseability is a first-class feature.** The CLI and MCP surfaces are not afterthoughts of the web app. They ship alongside it, they have a stable schema, and the data model is designed to be queryable, not just storable. The agent is a co-equal user with the human.
6. **Type as identity.** The terminal-editorial typography, the protocol vocabulary, the no-cards-no-shadows discipline — these are not stylistic preferences, they are the product's voice. A friendly re-skin is a fork, not a variant.

## Accessibility & Inclusion

Floor: WCAG 2.1 AAA where it does not cost. The existing system already does well on contrast (warm-black ink on warm-paper canvas; the teal accent on the warm background is well above 4.5:1) and on motion (every animation has a `prefers-reduced-motion` fallback that collapses to a 120ms cross-fade). The product is a portfolio piece; accessibility is part of that, not a separate checklist.

Concrete commitments:
- **Contrast**: AAA (7:1) on body text; AA (3:1) at minimum on large display text, status colors, and chart strokes. The `--fg-muted` and `--fg-subtle` ramp is tuned so even `--fg-subtle` body text clears 4.5:1 against `--bg`.
- **Motion**: every entrance, transition, and stagger has a `prefers-reduced-motion: reduce` fallback. The active timer's `cursor-blink` and the beat indicator's pulse are explicitly gated. Default to cross-fade, never to "no animation at all" — the motion is part of the system's identity and should survive, just slower and shorter.
- **Keyboard**: full keyboard reach for every interactive element. Custom controls (search combo, beat indicator, heatmap, modal) carry ARIA labels and roles. Focus rings stay visible (the existing 2px `--accent` outline is non-negotiable).
- **Screen readers**: the terminal-glyph vocabulary (`>>>`, `▸`, `█`, `░`, `⚠`, `✕`) is *visual*; every visible glyph has a screen-reader-only text equivalent. The status badges (`M / L / T / A`) spell out "Mastered / Learning / Todo / Archived" in `aria-label` and `sr-only` text.
- **Form controls**: native inputs under the custom styling (the visible `[x] / [ ]` checkbox is an enhancement on top of a real `<input type="checkbox">`, not a replacement).
- **Color is not the only signal**: success / warning / error states pair color with an icon or a label. `--accent` on its own never carries information.

The system should never be *less* accessible than a corporate time-tracker. The editorial voice is the product; the accessibility bar is the floor.
