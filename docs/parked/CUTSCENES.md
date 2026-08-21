# Parked: story cutscenes as layered stills

Kept as an option, not deleted. A full vertical slice of this was built and
measured on 2026-08-20, then discarded on Gil's call the next day: the idea is
liked, but it needs fleshing out before it is created for real. The first run
still belongs to the three enlistment discs. What follows is what the slice
settled, so the fleshed-out version starts from evidence instead of from zero.

## What it was

A cutscene was a list of SHOTS; a shot was a stack of three stills — far, mid,
near — moving at different rates under one slow zoom-and-pan, so a painted room
read as a camera move through it. A typed caption carried the dialogue at the
enlistment's 26 characters per second, with the enlistment's own gate: a tap
could never skip a line that had not finished arriving. The engine graded every
frame on the way out — grain, vignette, colour — the same treatment that makes
forty mission keyframes read as one show.

The slice was the eight-shot enrolment scene (room → officer → display wall →
over a shoulder → the tablet legend → one specimen → holo table → hand-off),
running on placeholder layers cut from the enlistment keyframe, driven from a
read-only lab that embedded the real game. Nothing ever reached it except a
`?cut=` query — the shipped game was untouched throughout.

## The decision it recorded

**In-engine layered stills, never video files.** Measured, not argued: five
cutscenes as 1080p video add ~40MB to a 32MB app; as layers they add under 2MB.
Video also cannot be re-timed, cannot localise (text is data here), and its
grade fights the engine's. If a beat truly needs motion, the answer is one
in-engine effect over a still, not an mp4.

## What the discarded slice proved

- **The memory policy works.** Decoded layers are the real cost — 2.95MB of
  RGBA per full-frame layer, whatever the WebP weighs. With an explicit policy
  (hold the current shot, the next, and the previous only until its cross-fade
  lands; no LRU — a timeline knows its future), eight shots ran at 16.9MB
  steady, 25.3MB peak, on worst-case uncropped layers. Cropping layers to their
  bounding box is the big saving left on the table.
- **The camera can be made seam-proof.** Zoom never below 1, pan measured in
  the slack the zoom creates, so ±1 is exactly the picture's edge on any
  aspect. Parallax fell out of the same numbers (far plane takes 55% of the
  near plane's move) — one number, nothing to keep in sync.
- **Draw-only survives review.** No `Math.random` (on a campaign level it IS
  the sim RNG — the replay verifier rule), no sim state, raw frame clock. A
  test enforced the RNG rule with comments stripped.
- **A boot trap, learned the hard way:** anything claiming `state` at boot must
  come AFTER the enlistment claim at the end of 99-boot, or a fresh profile
  overwrites it.
- **Never proved on a phone.** The Mac numbers above were the slice's whole
  evidence. The on-device measure was the next step when the work was parked.

## Why it was parked

Not for a technical reason — the runtime did what it claimed. The story side
was thinner than the engineering: five of the eight caption lines were drafts
written to fill shots, the art was placeholder by construction, and there was
no answer yet for which key points get scenes, what each scene must SAY, or how
the per-mission short beats relate to the briefing discs that already exist.
Building the real thing on that foundation would have hardened guesses into
canon. Flesh out the story first; the machinery is a solved problem waiting.

## What a return needs

1. The story pass: which beats get a scene, what each one says, script signed.
2. The art bible: one reference sheet per room, one per recurring character,
   before any final still. Humans stay painted keyframes — the engine renders
   no people, and a modelled one would look imported (91-briefing.js).
3. The art contract the slice settled: 1280×576 (2.222:1 — sides crop on
   narrow phones, never the top), subject in the central 65% of width, bottom
   30% expendable under the caption wash, full colour, no text/grain/frame,
   layers cropped to their box. Masters kept `_`-prefixed beside the exports.
4. The phone measure before anything is called done.

The slice's code can be rebuilt from this document in a session; it is not the
scarce part. The scarce part is item 1.
