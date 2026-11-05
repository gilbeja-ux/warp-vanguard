# Play statistics — what changes in the store forms

Drafted 2026-11-05 with the traction portal. **Nothing here is filed yet.** Gil
files both forms by hand, the day the first build with play statistics goes up
for review — not before, because a form that declares data the shipped build does
not send is as wrong as one that hides data it does.

The build in question is the first one carrying `src/game/34-telemetry.js`. Until
it ships, the answers in `PLAY-CONSOLE-ANSWERS.md` stay true.

## What the game sends, exactly

| Row | Fields | When |
|---|---|---|
| Session | start time, seconds on screen, platform, OS version, device model, app version, locale | once per app session, re-sent with a longer time at each flush |
| Stage attempt | mode, contract, stage index, result (clear / fail / quit), seconds flown, score, LANE ASSIST | at the end of every stage, replays excluded |
| Event | a slug and at most twelve short values — `fault` (site and version, never the message), `submit` (outcome and HTTP status), and later the tutorial's and the paywall's own events | when it happens |

All three carry the **anonymous Supabase id** the leaderboard already uses, taken
from the session token on the server. No advertising id, no device id, no IP
column, no free text, no third-party SDK. A model is a name like `Pixel 9a`.
Kept thirteen months, erased by *Delete my runs*, read only in aggregate.

Not sent at all: from a dev page (localhost, a LAN address, `file://`) unless the
URL says `?tel=1`, from an automated browser, or from the test harness and the
verifier.

## The decision to make first: the objection switch

Legitimate interest (Art. 6(1)(f)) is the settled basis — never consent, never a
prompt (`privacy-deletion-position`). Under that basis a player may object
(Art. 21), and today the only control is *Delete my runs*, which erases the past
but not the future: the game makes a new id and keeps counting. `telSetOff()` in
`34-telemetry.js` stops play statistics on a device and empties the queue; **no
screen calls it yet.**

| | With a PLAY STATISTICS switch in System Config | Without one |
|---|---|---|
| Objection | the switch | an email, which cannot reach a device, plus "play offline" |
| Play: Crash logs, Diagnostics | **Users can choose** | Required |
| Play: App interactions, User IDs | Required (the leaderboard needs them either way) | Required |
| privacy.html | name the switch in *Your controls* | the paragraph marked `OPEN` stays |

Recommended: ship the switch with the build. It is one row on a disc, it makes the
legitimate-interest balance easy to defend, and it costs the counts of the few
who turn it off.

## Google Play — Data safety

Top questions, unchanged: collects or shares data **Yes** · encrypted in transit
**Yes** · deletion request **Yes**, URL `https://warp.gb-il.cloud/delete-data.html`.

| Category | Type | Collected | Shared | Ephemeral | Required? | Purposes | Change |
|---|---|---|---|---|---|---|---|
| Personal info | User IDs | Yes | No | No | Required | App functionality, **Analytics** | add Analytics |
| App activity | App interactions | Yes | No | No | Required | App functionality, **Analytics** | add Analytics |
| App activity | Other user-generated content | Yes | No | No | Users can choose | App functionality | none |
| App info and performance | **Crash logs** | Yes | No | No | Required (or *Users can choose* with the switch) | **Analytics** | **new type** |
| App info and performance | **Diagnostics** | Yes | No | No | Required (or *Users can choose* with the switch) | **Analytics** | **new type** |

Why each one:

- **App interactions** — Play's own words are "how a user interacts with the
  app". Sessions, their length and every stage attempt are exactly that.
- **Crash logs** — "the number of times your app has crashed". The `fault`
  event is a count with a site and a version. No stack trace, but the type fits
  and declaring it costs nothing.
- **Diagnostics** — "any technical diagnostics". Device model, OS version, app
  version and a submit's HTTP status are technical facts about where the app
  runs and how it behaves.
- **User IDs**, not *Device or other IDs* — the same reasoning as before: the
  id is minted by the app and serves the leaderboard; it is not an IMEI, an
  Android ID or an advertising id. It is persistent per install, so if a reviewer
  reads *Device or other IDs* differently, adding that type (Analytics, App
  functionality) is the safe correction; removing *User IDs* is not.

Still **unticked**: Name, Email, Location, Financial info, Health, Messages,
Photos and videos, Audio, Files and docs, Calendar, Contacts, Web browsing,
Installed apps, Device or other IDs. **Shared** stays *No* everywhere: Supabase
is a processor acting on our instructions, which Play does not count as sharing.

The *Analytics* purpose is new. Leave *Developer communications*, *Advertising or
marketing*, *Personalization*, *Fraud prevention* and *Account management*
unticked.

**Is any data used for tracking or advertising?** → still **No**.

Then edit `PLAY-CONSOLE-ANSWERS.md` § *Data safety* to match, the same day.

## App Store — App Privacy (the privacy label)

**Do you or your third-party partners collect data from this app?** → **Yes**.

| Data type | Purposes | Linked to the user? | Used to track? |
|---|---|---|---|
| Identifiers → **User ID** | App Functionality, Analytics | Yes | No |
| Usage Data → **Product Interaction** | App Functionality, Analytics | Yes | No |
| User Content → **Gameplay Content** | App Functionality | Yes | No |
| User Content → **Other User Content** (the feedback note) | App Functionality | Yes | No |
| Diagnostics → **Crash Data** | App Functionality, Analytics | Yes | No |
| Diagnostics → **Other Diagnostic Data** | Analytics | Yes | No |

Why *Linked*: Apple counts data as linked unless the identifier is stripped
before collection, and every row carries the anonymous user id. The id is not an
identity in Apple's sense either, but *Linked* is the conservative and accurate
answer: a row can be traced to one install.

Why no tracking, and so **no App Tracking Transparency prompt**: nothing is
combined with data from other companies' apps or websites, nothing is shared with
a data broker, and no advertising runs. That is Apple's definition of tracking,
and none of it happens.

Not collected: Contact Info, Health and Fitness, Financial Info, Location,
Sensitive Info, Contacts, Browsing History, Search History, Device ID (no IDFA,
no IDFV), Purchases, Advertising Data, Other Data.

**Purchases becomes collected when the paywall ships** (Purchase History, App
Functionality, Linked) — that belongs to the paywall's own form change.

Compare this table with what was filed for 1.0.11 before saving: anything the
filed label has and this table lacks is either a mistake there or a gap here, and
either way it should be one decision, not two.

### Optional: a privacy manifest

Apple enforces privacy manifests only for listed third-party SDKs and for the
Required Reason APIs, and Capacitor ships its own. A `PrivacyInfo.xcprivacy` in
`ios/App/App/` declaring the same collected types is good practice, not a gate.
If it is ever added, it is an iOS-only file (Android's equivalent is this Data
safety form), so BUILD.md should say so.

## The documents that already say it

Updated in the same change, so the forms are the last step:

- `docs/privacy.html` — the policy (*Play statistics*, the basis, the user agent,
  thirteen months, *Delete my runs*), and its copy in `docs/index.html`
- `docs/delete-data.html` — what is deleted and kept
- `docs/testers.html` — *Your data*
- `docs/PRIVACY-POLICY.md` — the promises the code keeps

`docs/APP-STORE-REVIEW-NOTES.md` stays true: "no analytics SDK" — play statistics
are first-party code, not an SDK.
