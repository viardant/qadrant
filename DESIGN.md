# Terminal-Editorial hybrid — The Interface Design System

> Category: Custom · Surface: Web / Desktop (responsive) · Evidence: 6 in-app screenshots of *Piano Tracker* (macOS desktop), captured 2026-06-18.

A command-line shell dressed in editorial typography. The interface reads like a diagnostic dashboard or flight-deck display. Labels are short, technical, uppercase — `ACTIVE_PROTOCOL`, `TOTAL_MASTERY_INDEX`, `SESSION_ARCHIVED` — system status codes, not human copy. Monochromatic with one accent; drama comes from full-width black "stage drop" bands inside otherwise paper-bright flows. Typographic cinema: text typesets in, digits tune in, checkmarks draw themselves. No cards, no shadows — only thin borders and generous whitespace.

The system was distilled from a real product surface (Piano Tracker) so it ships with a working reference: a desktop piano-practice tracker whose screens include a Library list, an Insight Protocol detail, a Stats hero with mastery index + heatmap, and a Tempo metronome. Future projects can apply the same tokens, type, motion, and component vocabulary to any product that wants to read as a serious, instrumented, second-brain tool.

---

## 1. Visual Theme & Atmosphere

**Mood.** Quiet authority. The page is paper-warm, the type is editorial, the chrome is technical. The system is built for products whose users *want* to be told the truth in numbers, status codes, and small print — the way a flight-deck display tells a pilot the truth about the aircraft.

**Reading cues.**
- Paper-bright canvas (`#fdf8f8`) with container-lowest (`#ffffff`) and container-highest (`#e5e2e2`) neutrals — painterly, never sterile white.
- Black is the dramatic accent, not the canvas. It shows up as full-width stage drops (the `Total Mastery Index` band, the `Session Consistency` overview) inside the warm flow.
- One chromatic accent — teal-green (`#35675d`) — reserved for success, active state, and small UI primitives (dots, badges, chart lines). It never paints a background.
- Uppercase everywhere, with `letter-spacing: 0.05em` on tech-mono and `0.12em` on eyebrows.
- Hairline borders (1px) and dashed underlines on tappable values, signalling "tune this like a device."
- Icons stay on a single stroke weight, drawn from the same Lucide / Feather vocabulary (no decorative emoji, no fill color, no drop shadow).

**Product fit.** Best for: developer tools, instrument dashboards, life-tracking apps, learning/quantified-self tools, anything that wants to feel "your data, your interface, your control." Avoid for: consumer social, kids products, soft-commerce / wellness, any product whose tone is gentle or playful.

**Stage drop (full-width black band).** The signature dramatic device. A 100%-width, black-on-warm band that interrupts the flow to surface one high-stakes number (e.g. `Total Mastery Index 41.2%`). The band carries the headline in cream; below it the canvas resumes. Stage drops are reserved for the page's single most important number — once per view, never two on the same screen.

**Source evidence.** Six captured screens of *Piano Tracker*: library list (`assets/screenshot-library-list.png`), library detail with Insight Protocol cards (`screenshot-library-detail.png`), stats hero with mastery + weekly practice volume + learning distribution (`screenshot-stats-mastery.png`), session consistency heatmap (`screenshot-stats-streaks.png`), top repertoire + weekday + daytime heatmap (`screenshot-stats-distribution.png`), and the tempo/metronome screen (`screenshot-tempo-metronome.png`).

---

## 2. Color

### Tokens

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#fdf8f8` | Page surface. Warm off-white, never sterile. |
| `--surface-lowest` | `#ffffff` | Cards, popovers, raised modules. |
| `--surface-high` | `#e5e2e2` | Inset wells, dividers, disabled surfaces. |
| `--fg` | `#0a0a0a` | Default text. Near-black, slight warmth. |
| `--fg-muted` | `#5a5852` | Secondary copy, captions, icon strokes. |
| `--fg-subtle` | `#8a8780` | Tertiary metadata, placeholders, dashed-rule text. |
| `--border` | `#1a1a1a` | Hairline borders (1px), pill outlines, separator rules. |
| `--border-muted` | `#d8d4cf` | Soft dividers between list rows. |
| `--shell` | `#000000` | Stage-drop band, the page's dramatic full-width slab. |
| `--shell-fg` | `#fdf8f8` | Text *inside* a stage drop. |
| `--accent` | `#35675d` | Teal-green. The only chromatic color. Used for success, active state, small primitives, chart lines. |
| `--accent-soft` | `#a8d4c4` | Tinted teal for inactive heatmap cells, hover washes. |
| `--accent-mute` | `#cad9d2` | Lightest teal — empty heatmap cells, very low data density. |
| `--warn` | `#b58a2b` | Amber. Used for warning affordances (`⚠`). |
| `--error` | `#8b2e2a` | Used for error affordances (`✕`). |
| `--focus-ring` | `#35675d` | Same hue as accent, 2px outline on `:focus-visible`. |
| `--cursor` | `#0a0a0a` | Blinking-cursor color inside input fields. |

### Rules of use

- **Accent is rationed.** It is the only chromatic color. It is forbidden as a background fill, on stage drops, or on the page canvas. Use it for: a 6–10px dot, a chart line, an `M` / `L` status badge fill, a `GOOD_DAY` pill, a `0m / 7h` progress fill. Maximum two accent moments per screen.
- **Black is dramatic, not default.** The page canvas is paper, not black. Black appears only as a stage-drop band or as text. Do not paint cards, modules, or nav with black.
- **Muted is muted.** Use `--fg-muted` for body and `--fg-subtle` for metadata. Never use pure mid-gray; always pull from the warm cast.
- **Status colors are scarce.** Most states are rendered through opacity and weight, not color. Reach for `--warn` only when literally warning; reach for `--error` only when literally failing.

### Themes

The shipped theme is **paper / light**. A dark-mode variant inverts the canvas to `--shell` and stage-drops become the warm band, but the accent and type behave identically. Theme switching is reserved for system-preference respect; the light theme is canonical for marketing and product surfaces.

---

## 3. Typography

### Stack

- **Display / Headlines / Digits:** Space Grotesk, with `Inter` as a quiet fallback. Tight (`-0.02em`) tracking, weights 400 / 500 / 700.
- **Body / labels / metadata:** Inter, 400 / 500 / 600. Generous `0.01em` tracking on body, `0.05em` on small caps.
- **Tech mono (eyebrows, IDs, status codes):** JetBrains Mono, with `ui-monospace, SFMono-Regular, Menlo` as fallback. Always uppercase, `0.05em` tracking.

All three families are loaded from Google Fonts in `colors_and_type.css` via `@import`. If preserved font files appear under `fonts/`, swap the `@import` for explicit `@font-face` references; do not strip the family names from the stack.

### Scale

| Token | Size (clamp) | Weight | Letter-spacing | Use |
| --- | --- | --- | --- | --- |
| `display-xl` | `clamp(40px, 6vw, 72px)` | 700 | `-0.02em` | Page-level hero numbers (Total Mastery Index 41.2%). |
| `display-lg` | `clamp(36px, 4.5vw, 48px)` | 700 | `-0.02em` | Section headlines (e.g. Top Repertoire title). |
| `headline-md` | `clamp(22px, 3vw, 32px)` | 700 | `-0.01em` | Card titles, section anchors, big stat values. |
| `body-lg` | `18px` | 400 | `0` | Default body. |
| `body-md` | `16px` | 400 | `0` | Secondary body, dense lists. |
| `ui-label` | `14px` | 500 | `0.02em` | Buttons, controls, table headers. |
| `tech-mono` | `13px` | 400 | `0.05em` | Status codes, eyebrows (`SESSION_CONSISTENCY`), archive IDs. |
| `tech-mono-sm` | `11px` | 400 | `0.05em` | Captions, footer metadata, version stamps (`VERIFIED_V2.1`). |

### Style rules

- Display sizes are always 700. Body is always 400. Buttons are 500. Bold only when context demands it (a big stat, a stage-drop headline).
- Use `text-transform: uppercase` only on tech-mono and eyebrows — never on full sentences in body sizes.
- Digits inside stats use `font-variant-numeric: tabular-nums` so they don't reflow while animating.
- Body line-height is `1.55`. Headline line-height is `1.05–1.15`. Tech-mono is `1.35`.
- Dashed underlines (`text-decoration: 1px dashed var(--fg-subtle); text-underline-offset: 4px;`) mark tappable values — every `>__` placeholder that should feel "tunable" carries one.

### Type-as-motion

Text is *cinema*. Numbers animate digit-by-digit (blur → scale → settle) when they tune in. Eyebrows reveal character-by-character with a blinking cursor. Status pills typewriter-reveal. Don't be shy about staging typography — it carries the system's identity.

---

## 4. Spacing

### Scale

Base unit = `4px`. All distances are multiples of 4.

| Token | Value | Use |
| --- | --- | --- |
| `--space-1` | `4px` | Icon-to-label, inline rhythm. |
| `--space-2` | `8px` | Tight vertical gap between eyebrow and headline. |
| `--space-3` | `12px` | Inside-pill padding, badge gutters. |
| `--space-4` | `16px` | Card inner padding minimum, list row vertical padding. |
| `--space-5` | `20px` | Form field gap. |
| `--space-6` | `24px` | Gutter between sibling cards in a row. |
| `--space-8` | `32px` | Section padding (top/bottom of a card). |
| `--space-12` | `48px` | Section separation inside a page. |
| `--space-16` | `64px` | Margin-edge on desktop (1440px container max). |
| `--space-24` | `96px` | Stage-drop internal vertical padding. |
| `--space-32` | `128px` | Section gaps inside a long editorial flow. |

### Density

The system is editorially sparse, not data-dense. The default card has 32px internal padding and breathes 24–48px from its neighbours. List rows are 64–80px tall with a 1px hairline divider. The 4–5–6 spacing tier (16–24px) is the safe band for "normal" screens; reach for 12+ only when stacking many small elements.

### Radius

Four rungs, deliberately tight.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-none` | `0` | Default for most containers, badges, cards. |
| `--radius-xs` | `2px` | Hairline buttons, dense tags. |
| `--radius-sm` | `4px` | Pills (`M` / `L` status badges, segments). |
| `--radius-pill` | `999px` | Tab-bar items, round chips, BPM preset buttons. |

The system *prefers no radius*. Most surfaces — including cards — are square. A 4px corner only appears where the shape must read as "button" (e.g. `START_SESSION_PROTOCOL`, `+10 / -10` BPM adjusters).

### Border weights

| Token | Value | Use |
| --- | --- | --- |
| `--border-hairline` | `1px solid var(--border)` | All dividers, card outlines, pill outlines. |
| `--border-strong` | `1.5px solid var(--border)` | Active / focus-on container emphasis. |
| `--border-dashed` | `1px dashed var(--fg-subtle)` | Tunable underlines, "in-progress" rules. |
| `--border-none` | `0` | Default; only declare explicitly when overriding. |

### Shadows

**No shadows.** Drop shadows, glows, and elevation cues are forbidden. Depth is communicated through:
- The stage-drop black band (full-width, on a different surface).
- Hairline borders.
- Solid fills (`--surface-lowest` card on `--bg` canvas).

This is non-negotiable. Adding a shadow breaks the diagnostic-dashboard read.

---

## 5. Layout & Composition

### Container

- Max width `1440px`, `margin: 0 auto`, `padding-inline: var(--space-16)` (64px).
- Below `768px`, container padding collapses to `var(--space-6)` (24px); the canvas stays paper.
- Below `640px`, type scale compresses (see §3 clamp values); labels collapse from `14 DAYS AGO` to `LAST_14D_AGO`.

### Grids

- **Library list / detail:** single column, full-bleed rows. Each row is one piece (`Scriabin - Op. 11 N. 6 (Preludi)`), 64–80px tall, with a status pill on the left, a play affordance on the right, and `TOTAL` / `LAST` metadata below the title.
- **Insight cards:** 3-up grid on desktop (`grid-template-columns: repeat(3, 1fr)` with `24px` gutter), stacks to single column below `768px`. Each card has 32px padding, hairline border, eyebrow at the top, big stat, caption.
- **Stats hero:** full-width stage-drop band (140–220px tall) holding the master headline, then a two-column layout below: weekly chart on the left, donut / summary on the right. Below `1024px` the donut goes full-width.
- **Heatmaps:** wide single-row grid of square cells, 14–18px per cell, with `2px` gap, using accent shades for filled days.
- **Tab bar:** 4 fixed tabs (`LIBRARY / STATS / TEMPO / SETTINGS`), pinned to the bottom edge on desktop *and* mobile, with a hairline top border and 16–24px vertical padding.

### Responsive breakpoints

| Breakpoint | Behaviour |
| --- | --- |
| `≥ 1280px` | Full editorial sizing, 3-up insight grid, side-by-side stat layout. |
| `≥ 1024px` | Donut + chart side-by-side, stage-drop full-bleed. |
| `≥ 768px` | Single-column flows, 1440 container maxed at 100vw with 24px gutter. |
| `≥ 640px` | Type begins scaling down (see clamps in §3). |
| `< 640px` | Bottom-sheet controls, `LAST_XD_AGO` compact labels, single column everywhere. |

### Floating affordances

A single `+` floating action button, `48–56px` diameter, lower-right, hairline border, `--shell` background, `--shell-fg` glyph, drops a `6px` soft shadow on hover. Only one FAB per screen, only when there's a single primary "add" action.

---

## 6. Components

### 6.1 Status badge (`M` / `L` / `T` / `A`)
32–40px square, hairline border, `--radius-sm`, uppercase 1-char inside, `--tech-mono` type, 18–22px. Filled accent variant for active state (`M` Mastered), outlined muted variant for in-progress (`L` Learning), ghosted for archived (`A` Archived). Use the four canonical states — Mastered / Learning / Todo / Archived — and never invent new letters.

### 6.2 Stage-drop band
`background: var(--shell); color: var(--shell-fg); padding: 96px 64px;` on desktop; a single big-stat display-xl number centered, with a small tech-mono eyebrow above. Below the band the canvas resumes at `--bg`. One per page, never two.

### 6.3 Insight card
Hairline border, `--radius-none`, `--surface-lowest` background, padding `32px`. Eyebrow at top (`VOLUME`, `CONSISTENCY`, `DEDICATION`), big stat (display-md) below, sub-caption at the bottom in `--fg-muted`. Optional hairline divider between the stat and the sub-caption.

### 6.4 Big-stat block
Used for dashboard cards (`4h 48m`, `0 days`, `9 days`). Big number in `headline-md`, unit (`h`, `m`, `days`, `days`) in `--fg-muted`, smaller than the number. `font-variant-numeric: tabular-nums`.

### 6.5 Hairline divider
A 1px solid `--border` line spanning the full container width. Default row separator. No padding, no margin between rows.

### 6.6 Tab bar
4 equal-width cells, `padding: 16–24px 0`, hairline top border, an icon (single stroke, 20–24px) + uppercase 11–13px label stacked. Active state: filled accent dot (6px) above the icon, `--fg` color. Inactive: `--fg-muted`. Sticky to the bottom of the viewport on mobile; static on desktop.

### 6.7 Tunable value
A `--tech-mono` value with a dashed underline, `text-underline-offset: 4px`, `text-decoration: 1px dashed var(--fg-subtle)`. Renders identically to a `<span>`; becomes interactive via a click target that opens a sheet / dropdown.

### 6.8 Pill / Segmented control
`border-radius: 999px`, hairline border, padding `8px 16px`, `--tech-mono` label. Active: filled `--shell` background, `--shell-fg` color. Inactive: transparent background, `--fg` color. Used for BPM presets (`LARGHISSIMO 20`, `GRAVE 25`).

### 6.9 Beat indicator
Four 6px dots in a row, separated by 8px. Active beat uses `--fg`; inactive uses `--border-muted`. Each dot pulses in sequence with a 120ms delay (4-dot = 480ms cycle). Used in the metronome screen to show tempo tick readiness.

### 6.10 Block-character progress bar
Text-rendered `█` (filled) and `░` (empty) characters inside a `--tech-mono` span, e.g. `████████░░░░░░░░`. Width matches the bar's container. The pull-to-refresh bar (when present) is the canonical use.

### 6.11 Heatmap cell
A 14–18px square with `--radius-none`, 2px gap to neighbours. Filled states use `--accent-soft` (low), `--accent` (high), `--accent-mute` (very low). Empty cells use `--surface-high` as a 50% wash.

### 6.12 Pull-to-refresh
Top-edge handle: 2px tall hairline at scroll-top, with `>>> PULL_TO_REFRESH` text fading in below the handle as the user pulls. On release, the text changes to `>>> RELEASING…` and a block-character progress bar (`█` advancing) drives the refresh.

### 6.13 Form controls
- **Input:** hairline border, 56px tall, `--bg` background, `--tech-mono` placeholder uppercase, focus-ring 2px `--accent`.
- **Checkbox:** drawn as `[x]` / `[ ]` in `--tech-mono` rather than a native checkbox.
- **Toggle:** a `--shell` / `--fg-muted` pair, square corners, no radius.

### 6.14 Toast / status pill
`padding: 8px 12px`, hairline border, `--tech-mono` text 11–13px, uppercase. Three variants: success (accent left-border), warn (amber), error (error-red left-border). 1.5px left-border, otherwise hairline on the other three sides.

### 6.15 Empty state
A single 4-line `tech-mono` block, no illustration, no CTA button. Format:
```
ARCHIVE_EMPTY
NO SESSIONS LOGGED FOR THIS PIECE
>>> NEW_SESSION
```

---

## 7. Motion & Interaction

### Cubic-bezier signatures (only three)

| Name | Curve | Use |
| --- | --- | --- |
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances and exits — page transitions, modal in/out, slide reveals. |
| `ease-out-soft` | `cubic-bezier(0.25, 1, 0.5, 1)` | Sequential reveals — typewriter characters, beat indicators, list rows appearing in order. |
| `ease-out-pop` | `cubic-bezier(0.16, 1, 0.3, 1)` | Success pops — checkmark draw, completion badge, "session archived" confirmation. |

### Stagger timing

- **Character reveal:** 60ms per character (typewriter, eyebrow roll-in).
- **Sequential list reveal:** 80–120ms per row, capped at 8 rows; later rows appear at 200ms intervals.
- **Typewriter sequence:** 200–1200ms total, ending with a blinking-cursor settle (500ms on, 500ms off, infinite).

### Specific interactions

- **Buttons.** On click, a hairline ring `scale: 0 → 1.4` animates outward from the click point in 280ms (`ease-out-soft`), opacity 0.6 → 0. Active state depresses 1px.
- **List rows.** On hover, a 1px solid `--border` underline sweeps left-to-right in 200ms. On select, a 1.5px left-border in `--shell` appears instantly.
- **Tab switch.** Old tab content slides out (`translateX(-12px)`, 180ms `ease-out-expo`); new tab content slides in from the right (`translateX(12px) → 0`, 240ms `ease-out-expo`). Tab indicator (the 6px dot above the icon) animates with a 220ms ease-out-soft.
- **Beat indicator.** The active dot scales 1 → 1.4, opacity 0.4 → 1, over 120ms; the next dot follows 120ms later. Looping at 4× delay.
- **Pull-to-refresh.** Block-character bar advances `0% → 100%` over 800ms `ease-out-soft`, then snaps to 0% and the data refreshes.
- **Digit tune-in.** Each digit starts with `filter: blur(8px)`, `transform: scale(0.85)`, `opacity: 0`, and animates to `blur(0) scale(1) opacity(1)` in 320ms `ease-out-expo`, with a 60ms per-digit stagger.
- **Checkmark draw.** SVG path 24px square, `stroke-dasharray: 24`, `stroke-dashoffset: 24 → 0` over 500ms `ease-out-pop`.

### Reduced motion

When `prefers-reduced-motion: reduce` is set, replace all staggered / blur / scale animations with a 120ms cross-fade. Keep the type-character reveals as instant (no per-character animation). Beat indicators become static (the active dot stays solid).

### Loading

Never a spinner. Loading is a 4-dot beat indicator pulsing in sequence, or a block-character bar filling. Place the loader inline with the content it represents (next to a stat, inside a button) — never full-page unless the entire page is loading.

---

## 8. Voice & Brand

### Tone

Diagnostic. Authoritative. Slightly clinical. The system is talking to a user who *wants* to be measured. Avoid:
- Friendly or chatty copy ("Hi there! Let's get started…")
- Marketing superlatives ("Powerful", "Beautiful", "Easy to use")
- Question prompts ("Ready to begin?")
- Emoji as UI (the system uses terminal glyphs only)

### Capitalization

- All product labels, status codes, and section titles are **UPPERCASE**, separated by underscores for multi-word tokens: `TOTAL_MASTERY_INDEX`, `SESSION_CONSISTENCY`, `WEEKLY_PRACTICE_VOLUME`.
- Single-word product names use the canonical case (Piano Tracker, Library, Stats, Tempo, Settings).
- Status badges use a single uppercase letter (`M`, `L`, `T`, `A`).
- Sentence copy inside cards may be mixed case; status copy in tech-mono is always upper.

### Vocabulary

The system uses a small, fixed vocabulary of "protocol" terms. Re-use them — never coin new ones.

- `PROTOCOL` — a measured ritual or procedure (e.g. `PRACTICE_LAB`, `INSIGHT_PROTOCOL`).
- `SESSION` — a single tracked activity period.
- `ARCHIVE` — the historical record (e.g. `ARCHIVE_PROTOCOL_STREAK_ANALYSIS`, `ARCHIVE_ID: 35C20789`).
- `MASTERY` / `INDEX` — derived quantitative scores.
- `TAP` / `START` / `PAUSE` / `RESET` — primary control verbs, always uppercase.
- `VERIFIED_Vx.x` — version stamps (`VERIFIED_V2.1`).
- `>>> PREFIX` — every actionable affordance label is prefixed with `>>>` (e.g. `>>> NEW_SESSION`, `>>> PULL_TO_REFRESH`).
- `WARN` / `ERROR` — only used as standalone tokens, never as adjectives.

### Separators

Inside `tech-mono` strings, use `//` to separate tokens. Examples: `TOTAL: 4h 48m // LAST: 14 DAYS AGO`, `PRACTICE_LAB // ARCHIVE_ID: 35C20789`. Outside tech-mono, prefer the en-dash (`–`) for ranges and the colon (`:`) for key-value pairs.

### Punctuation

- Periods only at the end of complete sentences in body copy.
- Status codes, version stamps, and IDs do not take punctuation.
- Dashes are em-dashes (`—`) in body copy, en-dashes (`–`) in tech-mono ranges.

---

## 9. Anti-patterns

What the system explicitly forbids.

- **Drop shadows, glows, blur effects** on cards, modules, or nav. Depth comes from hairline borders and stage-drop bands.
- **Rounded cards** (radius > 4px). The default is 0; a 4px corner is allowed only on button-shaped elements.
- **Background colors other than the three neutrals** (`--bg`, `--surface-lowest`, `--surface-high`) and `--shell` for stage drops. No purple, no peach, no warm beige AI-canvas, no gradients, no accent-tinted backgrounds.
- **Inter, Roboto, or Arial as the display face** — display must be Space Grotesk (or a tighter-feeling editorial sans of similar weight). Inter is body-only.
- **Emoji as iconography** (`✨`, `🎯`, `🚀`). Use terminal glyphs (`>>>`, `▸`, `█`, `░`, `⚠`, `✕`) or single-stroke icons from the Lucide / Feather vocabulary.
- **Status colors for decoration.** `--accent` is rationed; `--warn` and `--error` are for actual warnings and errors only.
- **Filler copy** ("Feature One", "Track your habits"). Every label and metric must be specific and meaningful.
- **Generic AI icon rows** — three-up feature lists with an emoji icon + bold title + lorem paragraph. The system is too editorial for that shape.
- **Hand-drawn illustration or "playful" ornament** in the chrome. The only hero mark is a quiet wordmark or a single beat indicator; no sketches, no pastel scenes.
- **Invented metrics** ("10× faster", "99.9% uptime") without a source. If a number is unknown, leave an honest placeholder (`—`, `0m`, `0%`) and move on.
- **Card grids that look like SaaS marketing pages.** The system refuses to render as a startup landing page; it renders as a serious instrument panel.
- **Designer / preview controls inside product surfaces.** No theme toggles, no "Choose a platform" dropdowns, no "Settings" panels for layout, no "Demo" badges. A screen is the product, not the artifact's chrome.
- **Tab bars at the top.** The system uses a bottom tab bar (`LIBRARY / STATS / TEMPO / SETTINGS`) for the canonical app shell.

---

## 10. Product Surfaces (Piano Tracker reference)

The system ships a working reference — *Piano Tracker*, a macOS desktop piano practice tracker. The captured screens (`assets/screenshot-*.png`) are the source of truth for how the system is applied.

| Surface | What it does | Source screenshot |
| --- | --- | --- |
| Library list | A vertical list of pieces, each row showing the status badge, title, total time, last-played relative time, and a play affordance. The primary entry to start a session. | `screenshot-library-list.png` |
| Library detail | One piece expanded: title at display-xl, a `START_SESSION_PROTOCOL` primary action, and three Insight cards (Volume / Consistency / Dedication) summarising the piece's history. | `screenshot-library-detail.png` |
| Stats — Mastery | A full-width black stage-drop band with `Total Mastery Index 41.2%`. Below it, a 24-week practice volume line chart (accent stroke) and a Learning Distribution donut (M / L / T / A). | `screenshot-stats-mastery.png` |
| Stats — Streaks | A `Session Consistency` heatmap (one cell per day, accent shades), then three summary cards (`DAILY_AVG`, `WEEKLY_TOTAL`, `GOAL_PROGRESS`). | `screenshot-stats-streaks.png` |
| Stats — Distribution | `Top Repertoire` ranked by volume (horizontal accent bars), `Weekday Distribution` (vertical bar chart), and `Daytime Heatmap` (rows = day, columns = hour 0–23). | `screenshot-stats-distribution.png` |
| Tempo / Metronome | A centred BPM display with a beat indicator, fine/coarse adjusters (`-10 / -1 / +1 / +10`), primary `START` + secondary `TAP` buttons, and a horizontal row of classical tempo presets. | `screenshot-tempo-metronome.png` |

The UI kit (`ui_kits/app/`) is built against this same product surface, so future projects that apply the system have a real, working shape to start from.
