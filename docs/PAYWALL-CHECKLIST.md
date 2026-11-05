# The paid unlock: Gil's checklist

**The code is built (2026-11-05). The store side is yours.** Contracts 1 and 2 (stages
01–16) and the endless lane are free. One non-consumable purchase unlocks contracts 3, 4
and 5 (stages 17–40). The model and the code are in [RELEASE-PLAN.md](RELEASE-PLAN.md)
(*1.1: the paid unlock*) and in `src/game/34-license.js`.

The game shows the price the store sends it, in the player's own currency. **You set the
price in the two consoles, and nowhere else.** The plan says about $1.99.

One string ties the stores to the code. Type it exactly, on both stores:

```
com.warpvanguard.game.license
```

A product id cannot be renamed or reused once it is created, on either store. A typo
means a new id, and a new id means a one-line code change and a new build.

---

## 1. Google Play Console

Do these in order. Steps 1 and 2 can take a few days to clear.

1. [ ] **Payments profile (merchant account).** Play Console, the account level (not the
   app) → *Settings → Payments profile*.
   Link or create a Google payments profile. Google checks the identity and the bank
   account before it pays out. Without a profile, Play does not let you create a paid
   product.
2. [ ] **Tax and payout details.** In the same payments profile: the tax information Google
   asks for, the bank account, and the payout currency.
3. [ ] **The one-time product.** Play Console → the app → *Monetize with Play → Products →
   One-time products → Create one-time product*.
   - Product ID: `com.warpvanguard.game.license`
   - Name: what the purchase sheet shows, for example `Deep Range Clearance`
   - Description: for example `Unlocks contracts 3, 4 and 5: stages 17 to 40, for good.`
   - Purchase option: **buy**, not rent. Price about $1.99. Let Play convert the price
     for the other countries, then check a few by eye.
   - **Activate** the product. An inactive product does not come back from the query,
     and the game then shows UNLOCK with no price and answers NO ANSWER. TRY AGAIN.
4. [ ] **License testers.** Play Console (the account, not the app) → *Settings → License
   testing*. Add the Gmail address of each tester's phone. A license tester buys with a
   test card that is never charged, and the purchase sheet says so.
5. [ ] **A build in a test track.** Upload 1.1 to internal testing and install it from
   Play: Play answers billing for an app id that has a build with billing on a track, and
   the build Play installs is the one that is sure to match. The **sideload** build is a
   different app to Play (`com.warpvanguard.game.sideload`): it cannot buy. Use it for the
   R8 pass, not for purchases.
6. [ ] **Data safety form.** The game sends nothing about a purchase to our server: the
   only new data is a yes/no that stays on the device. Check the current Play guidance for
   apps that use Google Play Billing, and update the form only if Play asks for it.
7. [ ] **Store listing.** Paste the 1.1 copy from [STORE-MATERIALS.md](STORE-MATERIALS.md)
   §6. Play adds the *In-app purchases* label by itself.
8. [ ] **The content questions.** In [PLAY-CONSOLE-ANSWERS.md](PLAY-CONSOLE-ANSWERS.md), the
   *Does it allow purchases?* answer changes to **Yes** with 1.1.

## 2. App Store Connect

1. [ ] **The Paid Applications agreement.** App Store Connect → *Business* (the section
   was called *Agreements, Tax, and Banking*). Accept the Paid Apps agreement, then add the bank
   account and the tax forms. The agreement must show **Active** before a product can
   be sold, and before the sandbox can buy.
2. [ ] **The in-app purchase.** The app → *Monetization → In-App Purchases → +*.
   - Type: **Non-Consumable**.
   - Reference name: for example `Deep Range Clearance` (only you see it)
   - Product ID: `com.warpvanguard.game.license`
   - Price: the tier nearest $1.99. Check the other storefronts.
   - Localization: display name and description, the same words as on Play.
   - **Family Sharing**: your choice. On means one purchase covers the family. Once on,
     it cannot be turned off.
3. [ ] **The review screenshot.** Every new in-app purchase needs one screenshot for the
   reviewer, of the purchase in the app. Use the offer disc: open contract 3 on the
   carousel and tap GET CLEARANCE. On a web build, `index.html?paywall=fresh` shows the
   free tier even on a save that has the unlock. The screenshot is for review only; it is
   never shown on the store.
4. [ ] **Submit the product with the build.** The first in-app purchase must go to review
   with a new app version: on the 1.1 version page, add the product under *In-App
   Purchases and Subscriptions* before you submit.
5. [ ] **Review notes.** Paste the 1.1 notes from
   [APP-STORE-REVIEW-NOTES.md](APP-STORE-REVIEW-NOTES.md) (*1.1: the in-app purchase*).
6. [ ] **Sandbox testers.** *Users and Access → Sandbox → Test accounts → +*. Use an email
   address that is not an Apple Account already (a `+sandbox` alias works). On the test
   iPhone: *Settings → Developer → Sandbox Apple Account* (on older iOS: *Settings → App
   Store → Sandbox Account*), then sign in there, never in the main Apple Account field.
   A TestFlight build buys in the sandbox by itself, with no tester account at all.
7. [ ] **Store listing.** Paste the 1.1 promotional text and description from
   [STORE-MATERIALS.md](STORE-MATERIALS.md) §6. The App Store shows *In-App Purchases*
   on the listing by itself.

## 3. Before the 1.1 cut

1. [ ] **Answer the two open decisions** (each is one line in `src/game/34-license.js`):
   `WEEKLY_NEEDS_LICENSE` (may a free player file a weekly score? today: yes) and
   `GRANDFATHER` (who keeps stages 17–40 they had before the paywall? today: a save with
   progress past stage 16).
2. [ ] **One real purchase on each platform**, with a license tester on Android and a
   sandbox account on iOS: buy, kill the app, start it again (still unlocked), delete
   the app and install it again (unlocked again, at start-up, with no tap), and RESTORE
   PURCHASE in settings.
3. [ ] **One cancelled purchase and one slow card.** Play's test cards include *slow
   card, approves after a few minutes*: the disc says CLEARANCE PENDING, and the stages
   open by themselves when it clears.
4. [ ] **The R8 device pass** on the sideload build (`npm run aab` makes it): the new
   plugin is found by reflection, like every Capacitor plugin.
5. [ ] **The privacy page** (`docs/privacy.html`) has a *Purchases* section. Push it
   with 1.1, not before you want it public.
6. [ ] **The verifier.** The paywall moves the sim id (any byte does), so the verifier
   deploys before the build ships, as for every change under `src/game/`.
