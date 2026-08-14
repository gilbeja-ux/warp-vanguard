---
name: "Warp Vanguard"
description: A lit bore in dead space — everything is emitted light, machined metal, or void.
colors:
  signal-blue: "#50aaff"
  arc-white: "#ffffff"
  chrome-cyan: "#6fe3ff"
  breach-red: "#ff3c5a"
  armor-violet: "#d465ff"
  payload-gold: "#ffd24a"
  secure-green: "#7ee262"
  ember-amber: "#ff9a3c"
  null-graphite: "#2b3242"
  bore-void: "#020510"
  hull-black: "#03060e"
  panel-glass: "#040e1e"
  readout-ice: "#cfeeff"
  body-ice: "#bee1ff"
  strike-ice: "#bfeaff"
typography:
  display:
    fontFamily: "Audiowide, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(22px, 3.6vmin, 44px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "2px"
  headline:
    fontFamily: "Audiowide, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "2px"
  title:
    fontFamily: "Audiowide, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "3px"
  body:
    fontFamily: "Audiowide, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
  label:
    fontFamily: "Audiowide, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "3px"
  caption:
    fontFamily: "Audiowide, Segoe UI, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  readout:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.5px"
rounded:
  cut-sm: "8px"
  cut-md: "12px"
  cut-lg: "16px"
spacing:
  hairline: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "34px"
components:
  panel-console:
    backgroundColor: "{colors.panel-glass}"
    textColor: "{colors.readout-ice}"
    typography: "{typography.title}"
    rounded: "{rounded.cut-lg}"
    padding: "20px"
  button-key:
    backgroundColor: "#142c48"
    textColor: "#dff2ff"
    typography: "{typography.label}"
    rounded: "{rounded.cut-sm}"
    height: "38px"
  button-key-pressed:
    backgroundColor: "#1d3d61"
    textColor: "{colors.readout-ice}"
  button-destructive:
    backgroundColor: "#781a1a"
    textColor: "#ffd9d9"
    typography: "{typography.label}"
    rounded: "{rounded.cut-sm}"
    height: "38px"
  briefing-disc:
    backgroundColor: "#060b18"
    textColor: "{colors.body-ice}"
    typography: "{typography.body}"
    padding: "34px"
  disc-kicker:
    textColor: "{colors.payload-gold}"
    typography: "{typography.title}"
  mode-sector-primary:
    backgroundColor: "{colors.secure-green}"
    textColor: "{colors.bore-void}"
    typography: "{typography.label}"
  mode-sector-locked:
    textColor: "#6f8ba8"
    typography: "{typography.label}"
---

# Design System: Warp Vanguard

## Overview

**Creative North Star: "The Lit Bore"**

The world is an unlit warp lane, and light is the only material in it. Nothing here is a painted surface — every visible thing is either emitting, catching a single key light, or falling away into void. This is not a stylistic preference; it is the hard-won result of four rejected attempts at painted surfaces (checkerboard carpets, rungs, painted decals, filled hazard planes). Painted fills read as mud at every value in this palette. Luminous bars over a faint additive haze read as real. **Never paint a surface in this world. Draw the light it throws.**

The register is cold, luminous, and machined. Chrome is glass and light over dark metal: translucent navy fills, luminous header bands, corner brackets that hold a panel rather than decorate it. Everything is built rather than styled — a hairline speculars-on-machined-edges discipline that came directly from photographic reference (lens barrels, plasma discharge tubes, Marx generators) after two rounds of work were rejected as "too cartoony." What made cartoons: flat fills, colored rim-outline strokes, uniform lighting all the way around a circle, and saturated glow arcs. What fixed it: one world key light everything obeys, matte near-black metal with contrast only at machined edges, and no outlines anywhere.

Density is extreme in the center and empty at the edges. The player's whole field of attention is a bore roughly 88% of the screen's short side, and text, threats, instruments, and story all have to live inside that circle. There is no page, no scroll, no chrome rail — a single canvas, one ring, and the dark beyond it. Everything the system does is in service of a player reading depth, angle, and threat type in under a second.

**Key Characteristics:**
- One key light (`LIGHT_A = -TAU * 0.31`) that every metal surface in the game obeys
- No outlines, ever — form comes from value breaks at machined edges
- Color is the rule set, not decoration: hue tells the player which node can kill what
- Radial-first geometry; the bore's circle governs layout, type width, and motion
- Emitted light over painted fill, in every case, on every surface
- Film grain and vignette as the finishing pass, never as a texture layer underneath

## Colors

A void-dark field carrying six saturated signal colors, each of which means something mechanical. Saturation is high because these are lights, not pigments; the darkness around them is what makes them legible.

### Primary

- **Signal Blue** (`#50aaff`): Emitter ⊕, and every interface element that refers to it — dial pad gauge, pulse orb, lock sigils, emitter glyphs. It is this exact blue — not the lighter chrome cyan — because it must match the ⊕ phase-locked interdictor the player is asked to pair it with. That match is a gameplay rule, so the value is load-bearing and not available for aesthetic tuning.
- **Arc White** (`#ffffff`): Player node 02. The two nodes are deliberately a hue and an absence of hue rather than two hues, so they stay distinguishable in peripheral vision at speed.

### Secondary

- **Chrome Cyan** (`#6fe3ff`): The interface's own light — panel strokes, header bands, corner brackets, briefing-disc rims, callout type. Distinct from Signal Blue: cyan is the *console talking to you*, blue is *your equipment in the world*. Never use Chrome Cyan on anything the player can control or must match.
- **Breach Red** (`#ff3c5a`): Unphased interdictors, alarms, hazard bars, and the warden's entire livery. The most common threat color and therefore the baseline the player reads everything else against.

### Tertiary

- **Armor Violet** (`#d465ff`): Heavies and boss cores — the "both nodes required" class. Violet appears only where the answer is dual-node coordination.
- **Payload Gold** (`#ffd24a`): Reward, and only reward. See The Gold Rule.
- **Secure Green** (`#7ee262`): Secured runs, cleared relay lines on the route map, wins, and the TRACE speaker. Green never appears on a live threat.
- **Ember Amber** (`#ff9a3c`): Damage and recovery — the fry/reboot language. A killed node's seam sputters amber, its progress ring burns amber, and boss grapple clamps arrive molten. Amber means *this is broken and coming back*.

### Neutral

- **Bore Void** (`#020510`): The deep navy-black behind the tunnel wall circuitry. The true base of the world.
- **Hull Black** (`#03060e`): Document and shell background, and the native theme color. A half-step lighter than Bore Void so the canvas reads as a lit object sitting on a darker frame.
- **Panel Glass** (`#040e1e` at 92% opacity): Console panel fill. Always translucent — the lane must remain faintly visible through interface chrome.
- **Null Graphite** (`#2b3242`): Node-killer traps and fragments. Deliberately the calmest, least saturated body in the game — it looks harmless, and touching it fries a node for two seconds. The calm is the trap.
- **Readout Ice** (`#cfeeff`): Panel titles and stamped callouts.
- **Body Ice** (`#bee1ff` at 88%): Reading copy on discs and cards.
- **Strike Ice** (`#bfeaff`): Impact light — the flash a landed hit throws off. Score popups, the kill burst, ignition sparks, and the emitter's own discharge. In a world where everything is emitted light, the moment a strike connects is its own event and gets its own ink; it is not text colour that happens to be used on effects.

  It sits within a hair of Body Ice (`#bee1ff`) and that is not an accident to be tidied away: the two are the same ink doing different jobs, one reading copy and one impact. Collapsing them would be defensible as a palette cleanup, but it would move five shipped gameplay-feedback sites, so it should be a deliberate change and not a drive-by. Whichever way that goes, both names must keep pointing at whatever the answer is.

### Named Rules

**The Gold Rule.** Payload Gold appears only where the player *gains* something: the bonus ribbon, pulse charge, score, the leaderboard, contract value. Never on a hazard, never as decoration, never as a warm accent for contrast. This rule was paid for — the rim-wall hazard bars shipped in amber, read as inviting and bonus-like, and were recolored to Breach Red the same day. If gold is on screen, the player should be able to move toward it.

**The Match Rule.** Signal Blue and Arc White are reserved for the player's two nodes and the enemies keyed to them. No interface element, no marketing surface, and no effect may use a node color on something that is not a node or its matching lock. Ambiguity here is a gameplay bug, not a visual preference.

**The Calm Bait Rule.** The most dangerous body in the game is the least saturated one. Threat level is not communicated through visual loudness — it is communicated through learned color meaning. Never brighten Null Graphite to "warn" the player.

## Typography

**Display / UI Font:** Audiowide (bundled woff2, OFL) with `Segoe UI, system-ui, sans-serif` fallback
**Readout Font:** `ui-monospace, SFMono-Regular, Menlo, monospace`

**Character:** One voice for everything a human says, one voice for everything a machine reports. Audiowide is wide, geometric, and unmistakably a display face — it carries the whole product because there is no long-form reading anywhere in it. Monospace is texture and telemetry only: binary rain, hex codes, range readouts, `DOCK CONFIRMED / NODE 01 — ONLINE` status lines. Monospace is never used for a sentence the player must comprehend.

Audiowide ships at weight 400 only; the heavier weights below are canvas-synthesized emboldening. They are consistent across the product and are treated as real steps in the scale.

### Hierarchy

- **Display** (800, `clamp(22px, 3.6vmin, 44px)`, 2px tracking): Brand wordmark, level titles, boss title stamps. Always shrink-to-fit rather than wrap where the bore is narrow.
- **Headline** (800, 22px, 2px tracking): Briefing disc titles, victory report headings.
- **Title** (700, 13px, 3px tracking, uppercase): Console panel header bands. The widest tracking in the system — these read as engraved labels on hardware.
- **Body** (500, 15px, ~1.2 line-height): Briefing lines and card copy. Set on 3px extra leading (`fontSize + 3`), which is tight by web standards and correct here: the copy is two-to-four short lines inside a circle, and generous leading pushes it against the rim.
- **Label** (700, 12px, 3px tracking): Actions, `TAP TO CONTINUE`, mode names, stamped callouts.
- **Caption** (500, 9px): Sub-captions under mode keys, pad states like `OFFLINE`.
- **Readout** (monospace, 10px): Live telemetry — `RANGE 0xx.x M`, boot status lines, hex garnish.

### Named Rules

**The Chord Rule.** All in-bore text is clamped to the ring's clear chord at its own vertical position (`ringChord(y)`), then shrunk to fit (`fitPx`). Text never overlaps the ring band, and never wraps to a width the circle can't hold. Copy is authored short so the clamp rarely has to fight it — briefing lines are two lines of roughly forty characters.

**The Last Pass Rule.** Overlay text draws as the final pass of the frame. Audiowide is wide and earlier layers used to cover it. Nothing renders on top of copy the player must read.

**The Never-Animate-Size Rule.** Text emphasis animates through `ctx.scale` at steady alpha, never by animating font pixel size. Rounding font px per frame reads as chopping, and combining it with an alpha flicker reads as broken. A breathing hint scales; it does not resize.

**The Curved Label Rule.** Text laid on an arc (`arcText`) stays upright on both halves of the circle, and animated callers lock the flip decision to the element's *resting* angle so a spin can't toggle orientation mid-flight.

## Layout

There is no page. There is one full-bleed canvas and one circle, and every measurement in the system derives from the short side of the viewport.

**The canonical geometry:**
- Node ring radius: `0.44 × min(W, H)` — the ring nearly touches top and bottom
- Far ring: `2.5 × nodeR`, which pins the ring's depth to `hitZ = 0.25` **exactly, on every aspect ratio**
- Dial pad gauge width: `0.055 × min(W, H)`, bottom corners, safe-area aware
- Progress and integrity arcs: `nodeR + 0.125 × min(W, H)`, so they never touch the rim
- Briefing disc: `0.9 × nodeR` radius, with copy clamped to `60%` of the ring's diameter
- Mode wheel: sectors span `0.38 → 0.92 × R`, brand mark in the hub

The `2.5×` pin is the most important number in the file. It exists so that the reaction window — the time a threat takes to travel from spawn to the ring — is identical on every device. A previous formula derived the far ring from the screen diagonal and drifted the hit depth between 0.12 and 0.25 across aspect ratios, which would have made leaderboard scores incomparable between phones. Layout here is a fairness constraint before it is an aesthetic one.

**Density:** center-heavy and edge-empty. The bore holds threats, text, and story; the corners hold the two dial pads and nothing else. Panel chrome appears only in menus and overlays, never during play — in-run information lives on the objects themselves.

**Responsive behavior:** the composition is radial and scales continuously with `min(W, H)`; there are no breakpoints. Safe-area insets are read from `env(safe-area-inset-*)` and mapped into game space. The game is **landscape-locked** — the manifest declares `"orientation": "landscape"` and the client calls `screen.orientation.lock('landscape')` on entering fullscreen. The ring is sized off the short side (height), so the extra landscape width becomes tunnel and void on either side of the bore, and the two dial pads sit in the bottom corners at a natural thumb reach.

### Named Rules

**The No-HUD Rule.** Depth and priority never get a HUD element. Range rings, per-enemy countdown tags, flow-line chains, and priority numbers were all built and all reverted as clutter. Urgency lives on the enemy body — an urgency ramp over the final ~1.5 seconds driving LED panic-blink, glow, ripple, and sparks — plus stereo sonar ticks panned to each hostile's angle. If new information needs to reach the player mid-run, it goes on the object or into the sound field, not onto a panel.

## Elevation & Depth

**There are no box shadows and no elevation scale.** Depth is optical, not layered. Four mechanisms carry it, in this order of importance:

1. **One world key light.** `LIGHT_A = -TAU * 0.31`. Every metal surface — the monolith ring, bus-bars, enemy plates, machined optics — takes its glints, falloff, and contact shading from this single direction. Uniform lighting around a circle is the single fastest way to make this world look like a cartoon.
2. **Perspective projection.** Radius falls off as `1 / (1 + 6z)` up to the ring, with a quadratic term past it so the far end genuinely converges to a point instead of resting at a third of the ring's size.
3. **Emissive spill.** Lit elements light their neighbors. Charge glows in the *gaps* between dark decks rather than on their faces.
4. **Contact darkness.** Levitation and seating read as a tight dark shadow line, never as a glow gap.

The finishing pass is a cached radial vignette (transparent at `0.42 × min(W,H)`, `rgba(0,0,0,0.38)` at `0.72 × max(W,H)`) followed by film grain. Both are performance-gated behind the `lowFX` watchdog.

### Glow Vocabulary

Glow is this system's only "shadow," and it is always additive light, never a drop shadow:

- **Panel bloom** (`shadowColor: rgba(95,215,255,0.55)`, `shadowBlur: 16`): Console panels only; disabled under `lowFX`.
- **Signal halo** (radial gradient from the source color at ~0.8 alpha to fully transparent): Nodes, pickups, pulse waves.
- **Halation** (a long specular streak across a plasma body plus a soft bloom): Reserved for the highest-energy moments — arc discharge, pulse fire.

### Named Rules

**The Draw-Light Rule.** Never fill a surface to describe it. Describe it with the light it emits or catches. This is the most expensive lesson in the project: painted hazard carpets were rejected four times before the answer turned out to be a colonnade of luminous bars over an additive haze, with the tunnel still visible through it.

**The No-Outline Rule.** No element is ever given a colored rim stroke to define it. Contrast belongs on machined edges — hairline speculars, knurl bands, engraved index ticks.

**The Glow-Plus-Texture Rule.** When something must read as *energized*, add glow and texture, not line-drawn effects. Two styles of drawn electricity (random zigzags, harmonic ribbons) were both rejected; the shipped shield is a full-band glow plus film-grain scintillation composited at two speeds and scales, so the charge appears to boil inside the metal.

## Shapes

**Corners are cut, not rounded.** The signature chrome silhouette (`techRect`) clips the top-left and bottom-right corners at 45°, leaving the other two square. The asymmetry is the point — it reads as a machined plate with a keyed orientation rather than a soft UI card. Three cut sizes are in use: 8px on keys, 12px on dialogs, 16px on panels.

**Circles are structural, rectangles are informational.** Anything in the game world is radial: the ring, the nodes' arcs, the bore, the briefing discs, the mode wheel, the dial gauges. Anything reporting *about* the game is a cut-corner rectangle: panels, keys, dialogs, the route map's dossier. The player should never have to ask whether a thing is in the world or on the glass.

**Instruments share one gauge grammar.** Every readout in the game — dial pads, node coverage, progress, integrity — is built from the same three parts: a wide translucent track, two thin rails at its edges, and index ticks across it, with majors at the cardinals and minors between. Learn one instrument, read them all.

**Strokes are hairlines.** 1.5px for structural borders, 1px for inner hairlines, 1.2px for key borders. Nothing in the interface is drawn heavier than 2.5px except discharge itself.

### Named Rules

**The Keyed-Corner Rule.** Every cut-corner panel cuts the same two corners (top-left, bottom-right) in the same direction. A mirrored cut reads as a different manufacturer.

## Components

There is no DOM component library — the entire interface is canvas painters. These are the recurring, reusable ones.

### Console Panel

Cold, luminous, machined: glass over dark metal with a lit label band. The system's base container.

- **Shape:** Cut-corner plate, 16px cuts
- **Fill:** Panel Glass at 92% — the tunnel stays faintly visible through it
- **Border:** 1.5px Chrome Cyan at 65%, with a 16px cyan bloom (dropped under `lowFX`), plus a 1px inner hairline at 16% inset 4px
- **Header band:** 32px tall, left-to-right gradient from cyan at 35% to 2%, closed by a 1px rule at 50%
- **Title:** Readout Ice, Title role, inset 20px from the left, 21px from the top
- **Brackets:** Floating corner brackets 7px outside the plate, 14px arms, 1.5px Chrome Cyan at 55% — they do not touch the panel; they frame it like a target lock

### Keys (Buttons)

- **Shape:** Cut-corner, 8px cuts, 38px tall
- **Default:** Deep navy fill (`rgba(20,44,72,0.9)`), 1.2px Chrome Cyan border at 55%, `#dff2ff` label type
- **Destructive:** Oxide red fill (`rgba(120,26,26,0.92)`), 1.2px border `rgba(255,120,120,0.85)`, `#ffd9d9` label
- **Press:** Every key carries micro-feedback on press — a brief inset and brightening. There is no hover state; this is a touch product.
- **Focus (gamepad):** The focused key wears a ring in its own shape — wheel sectors glow as sectors, rectangles as rectangles.

### Briefing Disc

The signature component. Story and instruction arrive as a disc that flies up to the operator and back away — the product's one moment of theater.

- **Shape:** Circle at `0.9 × nodeR`, radial fill from `rgba(6,11,24,0.93)` at center to fully transparent at the rim, so it dissolves into the bore rather than ending
- **Rim:** 1.5px ring at 97% radius in `rgba(120,200,255,0.3)`, overlaid with four 2.5px accent arcs at 75% that drift slowly around it
- **Content order:** kicker → glyph → title → body → `TAP TO CONTINUE`
- **Kicker:** Payload Gold at 80% for a contract's briefing, Chrome Cyan at 70% for field instruction — gold marks the story, cyan marks the lesson. (The `CASE FILE // LC-2209` form this once specified is not drawn; the disc leads with the client and tier.)
- **Body:** Body Ice at 88%, shrink-to-fit against a 60%-of-diameter width budget, 3px extra leading
- **Story typing:** Briefing lines type themselves in at 46 characters per second with a block cursor and a teletype tick every other character
- **Motion:** Zoom in over 0.28s with an ease-out-back overshoot (`1.70158`), out over 0.18s; the field dims to `rgba(3,6,14,0.45)` unscaled beneath so the dim stays even while the disc flies
- **Prompt:** `TAP TO CONTINUE` pulses between 20% and 80% cyan at 4rad/s

### The Lane Chart (the lens on the network)

The campaign map is a circular LENS over one continuous isometric lane chart, sized so no campaign ever sees all of it.

- **Plane:** deep navy sheet, a 1.4px iso survey lattice at 7% cyan, and lanes in three traffic tiers — a minor lane is one 24% line, trunk lanes get a dark corridor between two lit markers, grand trunks get a wide corridor with a dashed centreline. Dashed teal warp-net carrier runs beneath the corridors with diamond junctions where they cross
- **Water:** a harbor across the south and a river bending down through the districts to meet it, cut as ONE path so a single clipped re-stroke of the avenues turns every crossing into a bridge. Lit banks and quays are what make water read at all — a fill this close to the ground colour is invisible on its own
- **Skyline:** pure wireframe — no opaque faces, a 10% roof tint only. Lots vary by kind, not just size: setback towers (podium → shaft → crown), two-lot office slabs, courtyard blocks, and terraced rows of three small houses. Density and height fall off from the core (spires downtown → slabs → sprawl → clumps in the dark); about 1% of towers burn magenta against the cyan
- **Cluster noise:** a second, much tighter noise field scales every height in a cluster together. Without it each site rolls its own dice and the skyline comes out as one flat carpet of near-identical boxes — the single biggest difference between "grid of cubes" and "inhabited system"
- **Clearance:** a lot is 32px wide, so blocks are held back 1.7–3.4 street-units from a road. At the old 1-unit clearance downtown swallowed its own streets and the grid stopped reading
- **Bloom:** each baked layer is composited back over itself blurred (`lighter`), so the whole sheet glows without per-shape shadow work
- **Falloff:** light dies with distance from the core systems — the plane is wiped out by ~95%, the structures only thinned, so the outer volume reads as settled space gone dark rather than as empty paper
- **Perimeters:** one dashed ellipse per campaign band (a ground circle in iso is a 2:1 ellipse), green inside → amber → red at the edge, studded with gate ticks and labelled with the cover it still holds
- **Runs:** buried — every cable run draws UNDER the skyline and ghosts up through it; the selected run is then repeated OVER the towers so a dense downtown can never swallow the line about to be defended

**The Cover Ladder.** A relay's ring is its CONTRACT's band, not its exact pixel radius. Forty relays over ~1,000px of radius means junction-lattice noise is larger than one hop's worth of outward progress, so per-relay cover would jitter — the dossier would claim level 5 is safer than level 4. Bands are fitted to the relays that actually landed in them, and cover ramps monotonically across each case and hands off to the next: 93% at the first relay of case 01, 2% at the last of case 05.

### Dial Pad

The player's only control, and the clearest expression of the gauge grammar.

- **Backing:** Radar fill, `rgba(10,20,45,0.35)`
- **Track:** Full-circle stroke at `0.85 × bz` in the node's own color, 16% at rest and 30% while held
- **Rails:** Two 1.5px circles at `±0.42 × bz` from the track center, node color at 40%
- **Ticks:** Eight compass ticks — majors at the cardinals at 50%, minors between at 28%
- **Boot:** A dormant pad is a dark ring labeled `OFFLINE`; power sweeps around the circle on the same clock as the node reboot
- **Extended aim:** When the grip drifts off-pad, a dashed ghost wheel and spoke project to the fingertip — the larger wheel *is* the fine-aim leverage, made visible

### Mode Wheel

The home screen: the ring's whole interior cut into color-coded sectors with the brand mark in the hub. Nothing overlaps the ring.

- **Geometry:** Sectors from `0.38 R` to `0.92 R`; three sectors, leaderboard at top, story and free flow at the bottom corners
- **Color:** Each sector carries its mode's color — Payload Gold (leaderboard), Secure Green (story), Chrome Cyan (free flow)
- **Primary:** Whatever moves the player forward pulses; locked sectors dim to `rgba(160,200,240,0.35)`
- **Labels:** Curved along their own slice, upright on both halves, one shared size across all sectors, shrink-to-fit
- **Motion:** The wheel spins out clockwise and crossfades on screen change; back reverses it

### The Arc Node

The system's biggest unification: the player's node is not an object on the ring, it *is* a lit sector of the ring, bounded by two machined bus-bars. **Its angular span is literally the zap tolerance** (`ARCFX.span = 0.314`) — the visual and the mechanic are the same number. Seven live filaments, each with its own waveform frequency, crawl bar to bar; the energy breathes with threat and dips after a discharge; bolts leap from both bars onto the target inside the arc.

Its damage state is choreographed: on a node-killer strike the arc **snaps shut** — bars slide together into a near-zero sliver with an amber ember sputtering in the seam — then regrows cold with a slight overshoot, and only reignites at full width, sputtering.

### Enemy Body (Nail Breach)

Interdictors are harpoons fired into the lane from *outside* — a machined plate seated flush on the lane wall with a graphite auger driving inward. Every one carries: a siphon beam, impact cracks, a soft grounding pool, a two-wave ripple train drawn in angle×radius wall space so it bows along the lane's hoops, a key-lit plate with bevel and vents, a type ring that telegraphs its class from spawn, and discrete drain packets flowing tip-to-plate — lane energy visibly bleeding away. That bleed is the interdiction: enough of it and the convoy drops out of transit.

### Enemy Body (Void Packet — the node killer)

The one threat that does not cling to the wall: a void-black rounded diamond floating in the bore, with a *negative* halo that swallows light rather than casting it, and a slow glint crawling its rim. It renders as a **failing video signal** — the body tears along horizontal scanline bands that displace sideways and drop out entirely (the tunnel shows through the hole), while the rim splits into red/cyan chromatic fringes. Corruption events fire roughly twice a second, but each one's severity is rolled off the static seed, so most are a one-band nudge and only a few are a full tear.

Two constraints define it, and both are load-bearing:

**It never escalates with proximity.** Every other body ramps its urgency as it closes; this one is identical at the horizon and at the ring. Escalation reads as "hostile, shoot it," and this enemy's whole design is bait you must let pass. It is not angrier up close — it is just wrong, the whole way in.

**Frequency without a fixed intensity.** A fast cadence at one severity reads as a blinking light. The per-event strength roll is what makes it read as a bad signal instead.

### Named Rules

**The Aberration Exception.** The killer's chromatic fringe is the one colored rim in the game, and it is not an outline — it is a sub-pixel-to-2px additive artifact that sums back into the old pale hairline while the two fringes overlap. It exists because a black body in a dark bore had no findable silhouette, which is why the split carries a hard pixel floor and may never reach zero. Anything wider or more opaque becomes the rejected cartoon outline.

**The Accumulating Phase Rule.** Effect phases only ever accumulate (`fxPh += dt * rate`). Never multiply raw time by an urgency- or state-dependent rate, and never seed an effect from a value that advances. Both mistakes cause visible phase jumps — they shipped once as a strobing "doubled lines" artifact near the ring.

**The Determinism Rule.** No visual effect may consume a draw from the campaign's seeded spawn RNG. An extra draw shifts the entire level sequence and breaks replay equality. Derive effect seeds from static properties like spawn angle.

## Do's and Don'ts

### Do:

- **Do** obey the single key light (`LIGHT_A = -TAU * 0.31`) on every metal surface, so far sides fall off and only machined edges catch a speculars.
- **Do** draw light instead of painting fills — luminous bars over additive haze, with the world still visible through them.
- **Do** keep the cut-corner silhouette keyed the same way (top-left, bottom-right) at 8/12/16px.
- **Do** build every instrument from the same track-plus-rails-plus-ticks grammar.
- **Do** clamp in-bore text to the ring chord and shrink it to fit, and draw it as the frame's last pass.
- **Do** reserve Payload Gold for gains only (**The Gold Rule**).
- **Do** put new mid-run information on the object or in the sound field, never on a HUD panel (**The No-HUD Rule**).
- **Do** finish with vignette then film grain, both gated behind `lowFX`.
- **Do** animate emphasis through `ctx.scale` at steady alpha, never by animating font size.

### Don't:

- **Don't** add a colored rim outline to define a shape. This is the fastest route back to "too cartoony," which has been rejected twice. The killer's chromatic fringe is the sole exception and only under **The Aberration Exception** — the first attempt at it was too wide and too strong, and read exactly like the rejected outlines.
- **Don't** light a circular object uniformly all the way around.
- **Don't** use flat fills plus saturated glow arcs as a material.
- **Don't** put gold on a hazard. Amber hazard bars shipped, read as an invitation, and were recolored to Breach Red the same day.
- **Don't** brighten Null Graphite. The node-killer's calm appearance is the trap. Its only emitted light is the blown-out sliver left behind a dropped-out band, and that fires with an event, never as a state.
- **Don't** use a node color (Signal Blue, Arc White) on anything that is not a node or its matching lock.
- **Don't** add drawn-line electricity to convey energy — use glow plus texture (both zigzag and harmonic-ribbon filaments were rejected).
- **Don't** add hit-stop or screen shake to routine kills. World flinch reads as bad; kill feedback is burst, rim flash, node recoil, and haptics.
- **Don't** use monospace for anything the player has to read as language.
- **Don't** introduce a melodic riser or pitch slide into the boot sequence — it reads as comical against the tactical register.
- **Don't** re-attempt the kill effect casually. Six iterations have been rejected; prototype options as screenshots or video and let the author pick.
