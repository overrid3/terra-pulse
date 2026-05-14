# Product

## Register

product

## Users

**Primary: dispatchers and operations managers at earthmoving / heavy-equipment rental companies.**

Context: office desk, 24"+ monitor, often multitasking on the phone with a client or a mechanic in the field. They scan a multi-mechanic timeline, drag service orders onto the right person, and need to know vehicle/mechanic state at a glance — without ever interpreting a tooltip. Tasks are reactive (a vehicle breaks down, reassign now) and rhythmic (plan tomorrow's reservations).

**Secondary: shop owners and back-office staff** managing the client list, vehicles, mechanics, and skills catalog. CRUD-shaped work, but the same audience — they don't want hand-holding.

The job: keep the fleet moving. Right machine, right mechanic, right site, right hire type, no double-booking.

## Product Purpose

Real-time service-order and reservation board for an earthmoving fleet. Dispatch live (`/dispatch`), manage workflow and overrides (`/orders`), maintain master data (`/mechanics`, `/vehicles`, `/clients`, `/skills`).

Success = a dispatcher trusts the board enough to leave it open all day. State transitions never lie. WS updates land before they refresh. Override path exists but feels like an escape hatch, not a shortcut.

POC scope: no auth, no native mobile, no MQTT, GPS faked via dev endpoint. Production hardening intentionally deferred — see CLAUDE.md "Scope fence."

## Brand Personality

Three words: **industrial, exact, unfussy.**

- **Industrial**, not cute. Talks like a tool for people who get dirt on their boots. No anthropomorphic mascots, no "Hey there!" copy, no celebration confetti when an order completes.
- **Exact**, not approximate. State badges, timestamps, durations, and serial numbers are first-class. The UI never rounds when it shouldn't.
- **Unfussy**, not stark. Confident defaults, dense where density helps, breathing room where decisions happen. Closer to Linear / Samsara / Fleetio than to consumer SaaS pastels.

Voice: terse, present-tense, imperative when actionable ("Dispatch", "Override state", "Reassign"). Errors quote the exact constraint that was violated.

## Anti-references

What this must NOT look like:

- **Consumer-SaaS cream + pastel gradients.** No Mailchimp, no Notion-marketing, no "fintech but friendly." This is an ops tool, not a productivity app for solopreneurs.
- **Hero-metric template.** Big number, tiny label, gradient accent, supporting stats grid. Saturated SaaS dashboard cliché.
- **Identical card grids.** Same-sized cards with icon + heading + paragraph, repeated. The dispatch board is the product; cards are not.
- **Construction-industry kitsch.** No hard-hat icons, no yellow-and-black hazard stripes, no orange-cone metaphors. The audience lives in this world; they don't need it cosplayed.
- **Map-first dashboards** (Uber-for-X). Mechanic location is a column, not a 60%-of-screen Mapbox view. Timeline is the primary surface.
- **Glassmorphism / drop-shadow stacking.** Surfaces are flat or single-elevation. No frosted overlays.
- **Side-stripe accent borders on cards / list items.** Use full borders, background tints, or leading state badges instead.

## Design Principles

1. **The board is the product.** `/dispatch` carries the brand. Everything else (CRUD pages) is utilitarian scaffolding that should feel cut from the same cloth but never compete for attention.
2. **State is sacred.** Every status (mechanic, vehicle, service-order, reservation) gets a deliberate color + label pair. Same enum value = same swatch everywhere. Never reinvent state colors per page.
3. **Density with rhythm.** Dispatchers want information per square inch, not infographics. Use spacing variation to create scan-stops, not to "let it breathe." Cards-everywhere is the failure mode.
4. **Action over chrome.** Buttons, drawer actions, and override controls win attention budget over decorative headers. Page titles can be small; the destructive button cannot be.
5. **Quiet until something matters.** The UI is mostly grayscale + one cobalt accent. Color reserved for state. When a thing turns red or amber, it earned it.

## Accessibility & Inclusion

- **Target: WCAG 2.2 AA.** Real contrast ratios, real focus rings, real keyboard paths — not lip service.
- **State must never rely on color alone.** Every status badge carries text. Iconography or pattern can reinforce in dense views (timeline blocks).
- **Colorblind-safe state palette.** Deuteranopia / protanopia checks for the green/amber/red triad on service-order states; pair hue with lightness shifts so the ordering survives grayscale.
- **Keyboard-first dispatcher path.** Selecting a mechanic, dispatching a pending order, opening the drawer, and committing an override should all be reachable without a mouse.
- **`prefers-reduced-motion` respected.** WS-driven board updates fade rather than slide; no parallax, no spring physics.
- **i18n-ready copy.** Strings short, no idioms, no embedded counts in sentences that can't pluralize.
