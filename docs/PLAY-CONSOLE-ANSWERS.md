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

Answer **Yes**. The route is **in-app**: the *MY DATA* panel on the leaderboard
screen and in *System Config* offers **rename my runs** and **delete my runs**,
both acting on every board at once. Email (`gilbeja.int@gmail.com`) remains as the
fallback for players who have already uninstalled. Give both if the form allows,
and the URL of `privacy.html` where it asks for documentation.

**The email route still has to be honoured** where it can be: an unanswered
request is a policy breach, not an untidy inbox. Watch that address. Note the
honest limit, which `privacy.html` states outright — entries carry no name, email
or account to look a person up by, so without the id held on their device we may
genuinely be unable to identify which rows are theirs. Reports of a *specific*
entry (real name, personal information, offensive handle) we act on regardless,
because those need no proof of who is asking.

> **Not required, and worth knowing:** Play's account-deletion mandate applies only
> to apps offering **account creation** — an app account being a user-facing
> identity that serves the user across apps and devices. The anonymous Supabase uid
> is neither. The control was built for GDPR Art. 21 and because a session token is
> better proof of ownership than a typed name, not to satisfy this form.

### Data types to declare

| Category | Type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|---|
| Personal info | **User IDs** | Yes | No | Required* | App functionality |
| App activity | **In-app actions** (scores, run results, replay traces) | Yes | No | Required* | App functionality |
| Personal info | **Name** | **No** — the display handle is user-chosen and not a real name | — | — | — |

\* **Required, and this is settled — do not answer "users can choose".** An
earlier draft of this file hedged, reasoning that a player who never submits
sends nothing. The code says otherwise: `endLevel` in `61-replay.js` calls
`lbSubmit` automatically at the end of every run that has a board, and there is
no setting anywhere that turns it off. A player is never asked and cannot
decline. Answering "optional" would put the form at odds with the binary, which
is the most common cause of Data Safety enforcement.

That answer changes only if a leaderboard opt-out is ever shipped — a settings
toggle read before `lbSubmit`. Worth doing eventually; it would also make the
GDPR position easier. It does not exist today.

### The per-type dialog

Clicking a data type opens three more questions. For **both** User IDs and
In-app actions:

| Question | Answer |
|---|---|
| Is this data processed ephemerally? | **No** — it is written to the database and kept indefinitely |
| Required, or can users choose? | **Data collection is required** |
| Why is this data collected? | **App functionality** only |

Leave *Analytics*, *Developer communications*, *Advertising or marketing* and
*Fraud prevention, security and compliance* unticked. Anti-cheat is performed on
the score and the replay trace, not on the identifier, and none of the rest
exist in this app.

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
