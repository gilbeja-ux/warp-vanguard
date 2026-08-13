# Play Console — the answers, prepared

Everything the Console asks that has a right answer for this game. Paste these
in; do not improvise. **The Data Safety form must match what the app actually
does** — a mismatch is one of the most common causes of rejection and of later
enforcement, and it is checked against the binary.

---

## App content → Privacy policy

```
https://gilbeja-ux.github.io/warp-vanguard/privacy.html
```

Served by GitHub Pages from this repo. **One-time setup by the account owner:**
repo → *Settings* → *Pages* → Source: *Deploy from a branch* → branch `master`,
folder `/docs` → Save. The URL is live a minute or two later. Contact address is
`gilbeja.int@gmail.com`; both the address and the policy text can be changed at
any time by editing `docs/privacy.html` and pushing.

## App content → Ads

**No, my app does not contain ads.** True: no ad SDK, no ad network, nothing.

## App content → Data safety

**Does your app collect or share any required user data types?** → **Yes**
**Is all data encrypted in transit?** → **Yes** (HTTPS to Supabase)
**Do you provide a way for users to request data deletion?** → **Yes**

Answer **Yes**, and where the form asks how, give the email route:
`gilbeja.int@gmail.com`. Play accepts a documented request channel — an in-app
control is not required, only a real way to ask that is actually honoured.
**It has to be honoured**: a deletion request that goes unanswered is a policy
breach, not an untidy inbox. Watch that address.

> **Owed before public launch:** an in-app *Delete my leaderboard data* control.
> Hand-processing is fine for a tester cohort and does not scale past it. When it
> ships, `privacy.html` changes the same day. Tracked in RELEASE-PLAN §2.

### Data types to declare

| Category | Type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|---|
| Personal info | **User IDs** | Yes | No | Required* | App functionality |
| App activity | **In-app actions** (scores, run results, replay traces) | Yes | No | Required* | App functionality |
| Personal info | **Name** | **No** — the display handle is user-chosen and not a real name | — | — | — |

\* "Required" in the sense that submitting a score requires them; playing the
game does not. If the Console offers "Users can choose whether this data is
collected", that is arguably **Yes** (a player who never submits sends nothing)
— answer Yes only if the flow genuinely makes it optional at the moment of
collection.

**Do NOT tick:** Location, Financial info, Health, Messages, Photos/Videos,
Files, Calendar, Contacts, App info and performance (no crash/analytics SDK),
Device or other IDs (the player id is app-generated, not a device identifier).

**Is any data used for tracking or advertising?** → **No.**

## App content → Content ratings (IARC questionnaire)

- Category: **Game**
- Violence: **No** — abstract geometric shapes are neutralised; no characters,
  blood, injury or weapons depicted realistically.
- Sexual content, language, controlled substances, gambling: **No** to all.
- **Does the app allow users to interact or exchange content?** → **Yes** —
  players see other players' chosen display names on leaderboards.
- **Does it share the user's current location?** → **No.**
- **Does it allow purchases?** → **No** (v1 is free with no IAP; this answer
  changes in 1.1).
- Expected outcome: roughly **PEGI 3 / ESRB Everyone**, with a *Users Interact*
  interactive-elements notice. That notice is normal and expected for anything
  with a leaderboard.

## App content → Target audience and content

- Target age group: **13+** (do **not** select an under-13 group — doing so puts
  the app in the Families programme, which brings much stricter requirements
  the leaderboard would have to satisfy).
- Is the app appealing to children? → **No.**

## App content → News, COVID, Data safety extras

- News app: **No.**
- Government app: **No.**
- Financial features: **No.**

## App content → Government/health/finance declarations

All **No**.

## Store settings

- App category: **Game → Arcade** (secondary: Action)
- Contains ads: **No**
- In-app purchases: **No** (v1)
- Free / Paid: **Free**

---

## Store listing copy — drafts

**App name (30 chars max)**
```
Warp Vanguard
```

**Short description (80 chars max)**
```
Two thumbs, one lane. Guard the convoy through a tunnel that never lets up.
```
*(74 characters.)*

**Full description (4000 chars max)** — draft, tighten before submitting:
```
You are the escort. Two emitters ride a ring at the mouth of a warp lane, one
under each thumb, and everything that wants your convoy has to come through
you.

Sweep a thumb to bring an emitter onto a threat and it burns. Dock both and
they fire as one. Bank enough charge and you can unleash a pulse that clears
the whole bore. It takes a minute to understand and a long time to be good at.

FIVE CONTRACTS
Forty relays across five escort contracts, each ending in a duel with a warp
leech — an outlaw engine clamped across the lane, drinking it. Every one of
them has to be read differently.

FREE FLOW
An endless lane that never stops getting faster. This is where the scores are.

WEEKLY LADDER
One seeded lane per week, the same for every player on earth, frozen when the
week closes. Every score is re-simulated on our server from your own inputs
before it is allowed on a board — no cheated run has ever stood, and none will.

BUILT FOR THUMBS
Landscape, two-thumb controls, no virtual stick, nothing to buy that makes you
better. Plays offline; leaderboards need a connection.
```

**Tags:** arcade, action, reflex, endless, leaderboard, offline

---

## Graphic assets — required sizes

| Asset | Size | Status |
|---|---|---|
| App icon | 512×512 PNG (32-bit, no alpha) | from `src/icons/wv-512.png` |
| Feature graphic | 1024×500 PNG/JPG | **owed** — brand lockup on a lane backdrop |
| Phone screenshots | 2–8, 16:9 landscape, min 1080px on the short side | generated from the real game |
| 7" tablet | only if tablet support is claimed | optional |
| 10" tablet | only if tablet support is claimed | optional |
