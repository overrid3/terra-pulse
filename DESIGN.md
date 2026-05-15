---
name: TerraPulse
description: Real-time service-order and reservation board for an earthmoving fleet.
design-system: Precision Industrial
colors:
  accent:                    "oklch(0.632 0.168 56)"    # #d97706 Precision Amber — primary actions
  accent-strong:             "oklch(0.483 0.145 51)"    # #8d4b00 Deep Amber — hover, brand text
  accent-soft:               "oklch(0.962 0.032 60)"    # amber tint for selected rows
  text:                      "oklch(0.185 0.004 155)"   # #1a1c1a near-neutral dark
  text-muted:                "oklch(0.382 0.042 44)"    # #554336 warm brownish secondary
  text-subtle:               "oklch(0.566 0.038 50)"    # #887364 table headers, captions
  surface-app:               "oklch(0.972 0.006 80)"    # #faf9f6 page background
  surface-panel:             "oklch(0.999 0.001 80)"    # #ffffff sidebar, panels
  surface-elev:              "oklch(0.999 0.001 80)"    # modal sheet
  surface-sunken:            "oklch(0.958 0.007 80)"    # #f4f3f0 insets, table headers
  surface-container:         "oklch(0.943 0.007 78)"    # #efeeeb hover, filter bar
  surface-container-high:    "oklch(0.929 0.007 76)"    # #e9e8e5 selected nav item
  surface-container-highest: "oklch(0.914 0.007 76)"    # #e3e2df stat cards
  hairline:                  "oklch(0.822 0.032 52)"    # #dbc2b0 borders
  hairline-strong:           "oklch(0.566 0.038 50)"    # #887364 focused field
  danger-fg:                 "oklch(0.509 0.185 25)"
  danger-bg:                 "oklch(0.928 0.046 20)"
  danger-hairline:           "oklch(0.84 0.07 25)"
  warn-fg:                   "oklch(0.50 0.13 82)"
  warn-bg:                   "oklch(0.95 0.06 85)"
  success-fg:                "oklch(0.45 0.13 150)"
  success-bg:                "oklch(0.93 0.06 150)"
  info-fg:                   "oklch(0.46 0.12 230)"
  info-bg:                   "oklch(0.94 0.035 225)"
  neutral-fg:                "oklch(0.566 0.038 50)"
  neutral-bg:       "oklch(0.92 0.012 70)"
  quoted-fg:        "oklch(0.44 0.15 295)"
  quoted-bg:        "oklch(0.93 0.05 295)"
typography:
  body-font:  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  mono-font:  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
  page-heading:
    fontFamily: "body-font"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.3
  panel-heading:
    fontFamily: "body-font"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.3
  sub-heading:
    fontFamily: "body-font"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "body-font"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  meta:
    fontFamily: "body-font"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "body-font"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  mono:
    fontFamily: "mono-font"
    fontSize: "0.92em"
    fontWeight: 400
rounded:
  sm: "2px"
  md: "4px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface-panel}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.surface-panel}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-default:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.danger-fg}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  panel:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "14px"
  chip:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.pill}"
    padding: "2px 6px"
  badge:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  input:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "7px 9px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  nav-link-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface-panel}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  modal:
    backgroundColor: "{colors.surface-elev}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "20px"
---

# Design System: TerraPulse

## 1. Overview

**Creative North Star: "The Dispatcher's Console"**

TerraPulse is the surface a dispatcher leaves open all day, on a 24-inch monitor at the front desk, with the phone in the other hand. The console reads like a tool that respects the user's time. Confident warm-tinted neutrals carry roughly 90% of every screen. A single clay accent at hue 38 marks the live thing: current selection, primary action, focused input, active nav link. Color is otherwise reserved for state: the same enum draws the same swatch in every view, so a dispatcher learns the palette once and reads the board for the rest of the year.

The palette shifted away from cobalt-on-slate because that family was reading either generic-SaaS or generic-SRE depending on the angle. Warm tinted neutrals with a clay accent borrows from industrial signage and printed work-order pads without falling into hard-hat kitsch. Closer in spirit to Linear's restraint, Samsara Fleet's information density, and the orange-bound notebooks on a service-desk shelf than to consumer SaaS. State-warn amber stays at hue 82 and state-danger shifts to brick at hue 25 specifically so neither fights the clay accent for attention.

This system rejects the consumer-SaaS family wholesale: no cream-and-pastel marketing palette, no gradient hero metrics, no map-first dashboards, no hard-hat icons. Cards are not the answer. Density is, with rhythm: spacing varies deliberately so the eye finds scan-stops without being given an infographic.

**Key Characteristics:**
- Restrained warm-neutral palette (hues 60-80) plus a single clay accent at hue 38, used on no more than 10% of any screen.
- Semantic state colors carry the load: same enum, same swatch, every screen.
- System sans only. No display font, no script, no all-caps eyebrow labels for flavor.
- Flat by default. Single 1px hairline borders convey structure; shadows are state-driven, not decorative.
- Motion is feedback, not choreography. 160ms ease-out-quart, fade not slide for WS updates.
- WCAG 2.2 AA contrast; state never communicated by color alone.
- Tables are baseline-aligned and single-line per row by default; multi-line data uses inline trailing meta, not subline divs.

## 2. Colors

The palette is **Restrained**: tinted warm neutrals from off-white parchment to deep ink, a single clay accent for action and selection, and a fixed semantic vocabulary for the state machine. OKLCH throughout; hue 38 anchors the accent, hues 60-80 anchor the neutrals, and the state hues (25 brick, 82 amber, 150 moss, 230 sky, 295 violet) sit far enough apart on the wheel that colorblind grayscale ordering survives.

### Primary
- **Clay Accent** (`oklch(0.58 0.16 38)`): primary action backgrounds, current selection, active nav link, focused input outline. Hover deepens to `oklch(0.50 0.17 38)`. Used on no more than 10% of any screen.
- **Clay Soft** (`oklch(0.94 0.05 50)`): selected row tint, active-nav adjacent surfaces. Tints, never strokes.

### Neutral
- **Console Ink** (`oklch(0.22 0.018 60)`): nav bar background, primary text on light surfaces.
- **Ink Elevated** (`oklch(0.30 0.020 60)`): nav-bar hover state.
- **Ink Soft / Muted** (`oklch(0.86 0.014 70)` / `oklch(0.72 0.014 70)`): nav-bar text variants on the dark header.
- **Body Text** (`oklch(0.26 0.016 60)`): default text on light surfaces.
- **Slate Body** (`oklch(0.54 0.014 65)`): meta lines, secondary text.
- **Text Subtle** (`oklch(0.44 0.014 65)`): table column labels, label captions.
- **Surface Panel** (`oklch(0.992 0.005 80)`): panel, card, modal sheet. Never raw `#fff`.
- **Surface App** (`oklch(0.970 0.008 78)`): page background. The warm cream that anchors the system.
- **Surface Sunken** (`oklch(0.955 0.010 75)`): inset surfaces (notes block, hover row, calendar inset behind absence picker).
- **Hairline** (`oklch(0.885 0.012 72)`): 1px borders and dividers.
- **Hairline Strong** (`oklch(0.62 0.04 60)`): focused-field border companion to the accent outline.

### Semantic state (named, fixed, never reinvented per page)

Pairs of `*-bg` and `*-fg` carry the state vocabulary. Same enum, same pair, every surface where it appears (badge, timeline block, drawer header, filter chip, calendar event).

- **REQUESTED / RESERVED / EN_ROUTE / TRAINING** (warn amber: bg `oklch(0.95 0.06 85)`, fg `oklch(0.50 0.13 82)`)
- **QUOTED** (violet: bg `oklch(0.93 0.05 295)`, fg `oklch(0.44 0.15 295)`)
- **APPROVED / AVAILABLE / IN_PROGRESS** (moss: bg `oklch(0.93 0.06 150)`, fg `oklch(0.45 0.13 150)`)
- **DISPATCHED / IDLE / IN_SERVICE / VACATION** (info sky: bg `oklch(0.94 0.035 225)`, fg `oklch(0.46 0.12 230)`)
- **COMPLETED / OFF_DUTY / OTHER** (neutral: bg `oklch(0.92 0.012 70)`, fg `oklch(0.42 0.014 65)`)
- **CANCELLED / OUT_OF_ORDER / SICK** (brick: bg `oklch(0.94 0.05 25)`, fg `oklch(0.50 0.18 25)`)

### Named Rules

**The One Voice Rule.** The clay accent appears on no more than 10% of any screen. Its rarity is what makes "this row is selected" or "this is the primary action" legible at a glance. Decorative clay is forbidden.

**The State-Is-Sacred Rule.** A given enum value (e.g. `IN_PROGRESS`) has exactly one swatch pair across every surface where it appears. New screens import the pair; they do not pick a new one. If a state needs a new home, edit `styles.css`; never inline a different swatch in a component.

**The Accent-vs-Amber Rule.** Clay (hue 38) and warn-amber (hue 82) sit forty-four hue degrees apart on purpose: amber state is dense in pending-heavy views, clay is rare. Hue separation is the load-bearing wall. Do not pull either color toward the other. Brick danger (hue 25) is also kept away from clay's hue specifically so destructive intent never reads as primary action.

**The No-Pure-Black, No-Pure-White Rule.** All neutrals carry chroma 0.005-0.018 toward warm hues 60-80. `#000` and `#fff` are banned.

## 3. Typography

**Body Font:** system sans stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif`).
**Mono Font:** system mono stack (`ui-monospace, SFMono-Regular, Menlo, monospace`) for serial numbers, VMRS codes, IDs, mechanic phone numbers, coordinate pairs, timestamps quoted from the system.

**Character:** native and unfussy. Dispatchers don't notice the typeface; that is the point. One family carries headings, labels, body, and data; emphasis comes from weight (400 / 500 / 600) and scale (0.72 / 0.85 / 0.875 / 1.05rem), not from a display face.

### Hierarchy

- **Page heading** (600, 1.05rem): page-level titles. Smaller than typical so the dispatch board, not the page chrome, holds attention.
- **Panel heading** (600, 1.05rem): `.panel h2`, the section labels inside a page. Same size as page heading by design; weight and position carry the difference.
- **Sub-heading** (600, 0.875rem): drawer headers, group labels, picker headings.
- **Body** (400, 0.875rem, line-height 1.45): default text. Prose caps at 65-75ch.
- **Meta / muted** (400, 0.85rem): timestamps, helper text, the `.muted` role.
- **Label** (600, 0.72rem, letter-spacing 0.04em, uppercase): table column headers. Uppercase nowhere else.
- **Mono data** (400, 0.92em relative, mono stack): VMRS codes, serial numbers, IDs, durations expressed numerically, coordinate pairs. A vocabulary signal that this value is a code, not prose.

### Named Rules

**The One-Family Rule.** No display face, no script, no second body sans. Hierarchy is built from scale and weight on one stack. Mono is a vocabulary signal, not a decorative choice.

**The No-All-Caps-Eyebrow Rule.** Uppercase is reserved for table column labels. Never used on buttons, never on section headings, never on nav links, never on badges.

**The Inline-Meta Rule.** When a table cell pairs a primary value (mechanic name) with a secondary value (phone), they sit inline with the secondary value dimmed and sized down to meta (`text-muted`, 0.85rem). Two-line sublines (`<div class="muted">…</div>` underneath a name) are prohibited because they break cross-column baseline alignment.

## 4. Elevation

Flat by default. The system has one elevation step at rest (level 0) and one optional state-driven step (level 1) used exclusively on the modal sheet. Cards, panels, list items, inputs, drawers, and the absence picker all sit at level 0 and are separated by 1px hairline borders, not by shadows. The dispatch drawer is a side column, not a floating overlay; it shares the page surface and is bordered, not elevated.

### Shadow Vocabulary

- **Modal lift** (`box-shadow: 0 8px 24px oklch(0.22 0.018 60 / 0.18)`): used only on the modal sheet over a `oklch(0.22 0.018 60 / 0.5)` backdrop scrim. Nothing else gets this shadow.

### Named Rules

**The Flat-By-Default Rule.** Surfaces rest at level 0. Shadows appear only on overlay surfaces (currently only the modal sheet). Decorative drop-shadows on cards, panels, or buttons are prohibited. Hover state is communicated by background tint, not by elevation.

**The Hairline Rule.** Structural separation uses a single 1px border in the Hairline neutral. Side-stripe accent borders (`border-left: 4px solid …`) are forbidden: full borders, background tints, or leading state badges instead.

## 5. Components

### Buttons
- **Shape:** gently squared (6px radius, `{rounded.sm}`).
- **Primary** (clay accent on parchment): used inside the nearest-mechanic modal, dispatch action, and other "do it now" actions. Background `oklch(0.58 0.16 38)`, text `oklch(0.992 0.005 80)`, padding 8px 12px, font-size 0.85rem.
- **Default** (parchment on parchment): the most common button. Background `oklch(0.992 0.005 80)`, text `oklch(0.26 0.016 60)`, 1px hairline border, padding 8px 12px. Hover deepens border to `oklch(0.62 0.04 60)` and pulls background to `oklch(0.955 0.010 75)`.
- **Ghost**: transparent background, transparent border, `text-muted` foreground. For toolbar dismissals and dialog close buttons. Hover pulls background to the sunken surface and the text to body.
- **Danger**: parchment background, brick foreground (`oklch(0.50 0.18 25)`), brick-tinted hairline border. Hover swaps to `danger-bg` background and a brick stroke. For row-level delete buttons only.
- **Focus**: 2px clay outline with 2px offset (keyboard focus only).

### Chips
- **Style:** background neutral (`oklch(0.92 0.012 70)`), foreground neutral-fg (`oklch(0.42 0.014 65)`), 999px radius, padding 2px 6px, 0.72rem.
- **In tables:** wrapped in `.cell-chips` so they stay on one line and scroll horizontally inside the cell if too many; never wrap to push the row taller.

### Badges
- **Style:** like chips but with a leading 6px state dot rendered via `::before { background: currentColor }`. The dot inherits the foreground color from the badge variant, so the state-pair carries through visually without needing two color tokens per state.
- **State variants:** one per enum value, each pulling from the semantic state pairs above. Never use a badge without a text label; state never relies on color alone.

### Panels / Containers
- **Corner Style:** 8px (`{rounded.md}`).
- **Background:** surface-panel (`oklch(0.992 0.005 80)`).
- **Border:** 1px hairline (`oklch(0.885 0.012 72)`).
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 14px default. The dispatch drawer panel uses 14px; the absence picker inside a panel adds its own padding-top after a 1px hairline divider.

### Inputs / Fields
- **Style:** 1px hairline border, 6px radius, 7px 9px padding, surface-panel background, body text. Mono stack used only for `.mono` cells, never on inputs.
- **Hover:** border strengthens to `hairline-strong`.
- **Focus:** 2px clay outline, 2px offset, border also at `hairline-strong`. The outline (not a glow) is the focus signal.
- **Datetime-local pair:** Start / End sit side-by-side in a 2-column grid inside the absence picker; they never stack on a single column on desktop.

### Navigation
- **Style:** the app header is ink with clay-text-on-clay only for the active link. Background ink (`oklch(0.22 0.018 60)`), nav link text ink-soft, hover state pulls background to ink-elevated. Active nav link is filled clay (`oklch(0.58 0.16 38)`), text panel-surface (parchment).
- **Typography:** body weight 0.875rem, no uppercase, no letter-spacing tweaks.

### Tables
- **Layout:** `.data-table`, 100% width, 1px hairline row dividers. Headers are 0.72rem uppercase labels in `text-subtle`. Cells are vertical-align middle with 10px 8px padding and line-height 1.4.
- **Multi-line content:** prohibited as a row-stretching pattern. Use `.cell-primary` (inline primary + dim meta) and `.cell-chips` (single-line scrollable chips) so all rows stay one text-line tall and baselines align across columns.
- **Row actions:** the last cell is right-aligned via `td.row-actions` (flex row, gap 4px, white-space nowrap). Edit + Delete sit together; Delete uses the Danger button variant.

### Dispatch timeline
- **Container** (`.timeline`): 1px hairline panel, 8px radius, clipped horizontally. The center column of the dispatch grid uses `minmax(0, 1fr)` and `min-width: 0` so react-big-calendar's content cannot push the page wider than the viewport.
- **Events:** the `.rbc-event` background is state-driven via the semantic pairs. Absence events are dimmed to 0.78 opacity and overlaid with a 135deg repeating linear gradient at 4px spacing so they read as "not available", not as a work block.
- **Today marker:** background tinted with clay-soft (`accent-soft`). Current-time indicator is a 1px clay line.

### Absence picker (`.absence-picker`)
A list-first compact form. The mechanic absence table is the primary surface; the picker appears below it only when adding or editing. The form is a 2-column grid (Start / End / Type / Reason). A `Pick on calendar` toggle reveals a height-capped (320px) week-only react-big-calendar inset behind a sunken surface and hairline border. Month view is prohibited; it makes the calendar dominate the page and breaks the list-first layout the dispatcher relies on.

## 6. Do's and Don'ts

### Do:
- **Do** reserve the clay accent (`oklch(0.58 0.16 38)`) for primary action, current selection, active nav link, and focused input outline. No more than 10% of any screen.
- **Do** use the same swatch pair for the same enum value across every screen the enum appears on. Open `styles.css` and reuse; never invent a one-off.
- **Do** tint every neutral toward warm hues 60-80 (chroma 0.005-0.018). Parchment, not paper.
- **Do** pair every state color with a text label and, where space allows, a leading dot. State never relies on color alone.
- **Do** vary spacing for rhythm: dense data tables run tight (10px 8px cells), decision surfaces (drawer actions, override controls) get breathing room.
- **Do** prefer inline disclosure (the absence picker pattern, the override form pattern) and side drawers (the service-order drawer) over modals. Modals only for genuinely blocking confirmations (the nearest-mechanic dispatch step).
- **Do** respect `prefers-reduced-motion`. WS-driven updates fade rather than slide.
- **Do** use the mono stack for serial numbers, VMRS codes, IDs, phone numbers, and numeric coordinate pairs.
- **Do** keep table rows single-line where possible; pair primary + secondary values inline with `.cell-primary` so all cells in a row share a baseline.

### Don't:
- **Don't** use consumer-SaaS cream + pastel gradients. No Mailchimp, no Notion-marketing, no "fintech but friendly."
- **Don't** build the hero-metric template: big number, tiny label, supporting stat grid, gradient accent. Prohibited.
- **Don't** repeat identical icon + heading + paragraph card grids. The dispatch board is the product; cards are not.
- **Don't** drop construction-industry kitsch into the UI: no hard-hat icons, no yellow-and-black hazard stripes, no orange-cone metaphors. Clay is a tinted neutral mate, not a safety vest.
- **Don't** make a map the primary surface. Mechanic location is a column; the timeline is the product.
- **Don't** use glassmorphism, frosted blurs, or stacked drop-shadows. Surfaces are flat; the modal sheet is the only place a `box-shadow` is allowed.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on cards, list items, or callouts. Full borders, background tints, leading badges instead.
- **Don't** use `background-clip: text` gradients on any heading. A single solid color, emphasis via weight.
- **Don't** use `#000` or `#fff` anywhere. Tint toward the warm hue family.
- **Don't** use em dashes in copy. Commas, colons, semicolons, periods, or parentheses.
- **Don't** invent a new color for a state that already has one. Open `styles.css`, reuse the pair.
- **Don't** put a phone, address, or any secondary value on a second line under a primary value in a table cell. Inline meta with `.cell-primary` and dim the secondary; two-line cells break baselines across columns.
- **Don't** expose a month-view calendar in the dispatch timeline or the absence picker. The dispatch timeline is day/week only; the absence picker is week only inside the optional inset. Month view dwarfs the page and erodes the list-first pattern.
