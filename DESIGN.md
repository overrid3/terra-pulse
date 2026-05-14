<!-- SEED: re-run /impeccable document once tokens are extracted from code to capture the real values and components. Current web/src/styles.css uses hand-rolled CSS with hex constants; a scan-mode pass will lift those into the frontmatter. -->

---
name: TerraPulse
description: Real-time service-order and reservation board for an earthmoving fleet.
---

# Design System: TerraPulse

## 1. Overview

**Creative North Star: "The Dispatcher's Console"**

TerraPulse is a tool for someone on the phone with one hand and the keyboard with the other. The console is built for trust, not for warmth. Confident neutrals carry 90% of every screen. A single cobalt accent marks selection, primary action, and "this is the live thing." Color is otherwise reserved for state, the same enum drawn the same swatch in every view, so a dispatcher learns the palette once and reads the board for the rest of the year.

This system rejects the consumer-SaaS family wholesale. No cream-and-pastel marketing palette. No gradient hero metrics. No hard-hat-and-hazard-stripe industry kitsch. Closer in spirit to Linear, Samsara Fleet, Fleetio: dense, terse, exacting, with restraint that buys credibility. Density is the point, but density needs rhythm; spacing varies deliberately so the eye finds scan-stops without being given an infographic.

**Key Characteristics:**
- Restrained palette: tinted slate neutrals plus a single cobalt accent (<10% surface area).
- Semantic state colors carry the load: same enum, same swatch, every screen.
- System sans only. No display font, no script, no all-caps eyebrow labels for flavor.
- Flat by default. Single 1px hairline borders convey structure; shadows are state-driven, not decorative.
- Motion is feedback, not choreography. 120-200 ms ease-out-quart, fade not slide for WS updates.
- WCAG 2.2 AA contrast; state never communicated by color alone.

## 2. Colors

The palette is **Restrained**: tinted slate neutrals from off-white to near-black, a single cobalt accent for action and selection, and a fixed semantic vocabulary for the state machine. Exact OKLCH values are deferred until a scan-mode pass resolves the current `web/src/styles.css` constants into tokens.

### Primary
- **Cobalt Accent** `[to be resolved during implementation — anchored on existing #2563eb, retuned to OKLCH ~oklch(57% 0.20 260)]`: primary actions, current selection, active nav link, focused input ring. Used on no more than 10% of any screen.

### Neutral
- **Console Ink** `[anchored on existing #0f172a]`: nav bar background, primary text on light surfaces.
- **Slate Body** `[anchored on existing #475569 / #64748b]`: secondary text, meta lines, table column labels.
- **Surface Panel** `[approx #ffffff with chroma 0.005 toward cobalt]`: panel and card surfaces. Never raw `#fff`.
- **Surface App** `[anchored on existing #f1f5f9]`: page background.
- **Hairline** `[anchored on existing #e2e8f0]`: borders and dividers.

### Semantic state (named, fixed, never reinvented per page)
The service-order, mechanic-status, vehicle-status, and absence enums each get a deliberate swatch pair (background tint + foreground text) audited for colorblind-safe lightness ordering. Current `state-*` and `status-*` classes in `styles.css` are the starting set; canonical OKLCH values land on the next scan-mode pass.

- REQUESTED / RESERVED → amber
- QUOTED → violet
- APPROVED / AVAILABLE / IN_PROGRESS (mechanic) → green
- DISPATCHED / EN_ROUTE / IDLE → cobalt-tinted blue (distinct from primary accent)
- COMPLETED / OFF_DUTY → slate
- CANCELLED / OUT_OF_ORDER → red

### Named Rules
**The One Voice Rule.** The cobalt accent appears on ≤10% of any screen. Its rarity is what makes "this row is selected" or "this is the primary action" legible at a glance. Decorative cobalt is forbidden.

**The State-Is-Sacred Rule.** A given enum value (e.g. `IN_PROGRESS`) has exactly one swatch across every surface where it appears: badge, timeline block, drawer header, filter chip. New screens import the swatch; they do not pick a new one.

**The No-Pure-Black, No-Pure-White Rule.** All neutrals carry chroma 0.005-0.01 toward the cobalt hue. `#000` and `#fff` are banned.

## 3. Typography

**Body Font:** system sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif`).
**Mono Font:** system mono stack (`ui-monospace, SFMono-Regular, Menlo, monospace`) for serial numbers, VMRS codes, timestamps, IDs.

**Character:** native and unfussy. Dispatchers don't notice the typeface, which is the point. One family carries headings, labels, body, and data; emphasis comes from weight and scale, not from a display face.

### Hierarchy
*Exact rem values land on the next scan-mode pass; the scale below is the target ratio (~1.2x) and weight strategy.*

- **Page heading** (600 weight, ~1.15rem): page-level titles in the nav. Smaller than typical because the dispatch board, not the page chrome, deserves attention.
- **Panel heading** (600, ~1rem): `.panel h2` style; section labels inside a page.
- **Sub-heading** (600, ~0.95rem): drawer headers, group labels.
- **Body** (400, 0.875rem, ~1.5 line-height, 65-75ch for prose): default text size; matches the current `14px` body baseline.
- **Meta / muted** (400, ~0.8rem): timestamps, helper text, the `.muted` role.
- **Label** (500-600, ~0.78rem, letter-spacing ~0.04em, uppercase): table column headers; sparingly used elsewhere.
- **Mono data** (400, ~0.85em, mono stack): VMRS codes, serial numbers, IDs, durations expressed numerically.

### Named Rules
**The One-Family Rule.** No display face, no script, no second body sans. Hierarchy is built from scale and weight on one stack. Mono is a vocabulary signal (this value is a code, not prose), not a decorative choice.

**The No-All-Caps-Eyebrow Rule.** Uppercase is reserved for table column labels. Never used on buttons, never on section headings, never on nav links.

## 4. Elevation

Flat by default. The system has one elevation step (`0`, the page) and a single optional state-driven step (`1`, used only on modal backdrops and the dispatch drawer when it overlays the timeline). Cards, panels, list items, and inputs sit at elevation `0` and are separated by 1px hairline borders, not by shadows.

### Shadow Vocabulary
*Exact values land on the next scan-mode pass.*

- **Modal lift** (`box-shadow: [to be resolved]`): used only on the modal sheet over a `rgba(15, 23, 42, 0.5)` backdrop. Nothing else gets this shadow.
- **No hover lift on cards or list items.** Hover state is communicated by background tint, not by elevation.

### Named Rules
**The Flat-By-Default Rule.** Surfaces rest at elevation 0. Shadows appear only on overlay surfaces (modal sheet, anchored drawer at narrow viewports). Decorative drop-shadows on cards, panels, or buttons are prohibited.

**The Hairline Rule.** Structural separation uses a single 1px border in the Hairline neutral. Side-stripe accent borders (`border-left: 4px solid …`) are forbidden: full borders, background tints, or leading state badges instead.

## 5. Components

*Components are omitted in seed mode. The current `web/src/styles.css` defines real button, panel, badge, drawer, modal, table, form, and chip styles; a scan-mode pass will lift those into structured component tokens and a `.impeccable/design.json` sidecar with HTML/CSS snippets for the live panel. Until then, treat existing classes in `styles.css` as the temporary source of truth, with the named rules above as the doctrine.*

## 6. Do's and Don'ts

### Do:
- **Do** reserve the cobalt accent for primary action, current selection, and active state. ≤10% of any screen.
- **Do** use the same swatch for the same enum value across every screen the enum appears on.
- **Do** tint every neutral toward the cobalt hue (chroma 0.005-0.01).
- **Do** pair every state color with a text label and, where space allows, a leading icon. State never relies on color alone.
- **Do** vary spacing for rhythm: dense data tables can run tight; decision surfaces (drawer actions, overrides) get breathing room.
- **Do** prefer inline disclosure and side drawers over modals. Modals only for genuinely blocking confirmations.
- **Do** respect `prefers-reduced-motion`. WS-driven updates fade rather than slide.
- **Do** use the mono stack for serial numbers, VMRS codes, IDs, and numeric durations.

### Don't:
- **Don't** use consumer-SaaS cream + pastel gradients. No Mailchimp, no Notion-marketing, no "fintech but friendly."
- **Don't** build the hero-metric template: big number, tiny label, supporting stat grid, gradient accent. Prohibited.
- **Don't** repeat identical icon + heading + paragraph card grids. The dispatch board is the product; cards are not.
- **Don't** drop construction-industry kitsch into the UI: no hard-hat icons, no yellow-and-black hazard stripes, no orange-cone metaphors.
- **Don't** make a map the primary surface. Mechanic location is a column; the timeline is the product.
- **Don't** use glassmorphism, frosted blurs, or stacked drop-shadows. Surfaces are flat.
- **Don't** use `border-left` or `border-right` >1px as a colored accent. Full borders, background tints, leading badges instead.
- **Don't** use `background-clip: text` gradients on any heading. A single solid color, emphasis via weight.
- **Don't** use `#000` or `#fff` anywhere. Tint toward the cobalt hue.
- **Don't** use em dashes in copy. Commas, colons, semicolons, periods, or parentheses.
- **Don't** invent a new color for a state that already has one. Open `styles.css`, reuse the swatch.
