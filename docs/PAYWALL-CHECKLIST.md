# The paid unlock: Gil's checklist

> **SHELVED (Gil, 2026-11-06).** Monetization waits for traction: a trader on Google Play and the EU App Store shows a phone number and an address to everyone, and a business address costs money the game may never earn. The paywall is built and switched off (`PAYWALL_ON = false` in `src/game/34-license.js`): every stage is free, nothing is sold, and settings has no RESTORE PURCHASE row. Nothing below goes live until the switch turns on.

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
3. [ ] **Trader status (due 2027-02-01; blocks the 1.1 launch).** Google's email of
   2026-11-05: every developer declares trader or non-trader. The 1.1 in-app product makes
   you a **trader** under EEA and UK law, because the game is sold in those countries.
   Non-trader is true only if every EEA country and the UK are removed from the app's
   countries. The other steps here do not wait for this one.
   - First, find the business address and phone number to show (Gil, 2026-11-05: he gets
     both before 1.1 goes live). Google shows a trader's phone and address on the store
     page, and verifies the phone, so it must receive Google's code. Check which
     addresses Google accepts before you pay for one.
   - *Manage account → Account details → About you → Trader status*: choose **Trader**,
     verify the phone, certify that you comply with local laws, save.
   - The app → *Policy and programs → App content → Needs attention*: confirm that the
     trader status applies to Warp Vanguard. A Terms of Service link is optional.
   - Miss the date and Google blocks updates, then removes the developer profile and
     every app, in every country.
4. [ ] **The one-time product.** Play Console → the app → *Monetize with Play → Products →
   One-time products → Create one-time product*.
   - Product ID: `com.warpvanguard.game.license`
   - Name: what the purchase sheet shows, for example `Deep Space Clearance`
   - Description: for example `Unlocks contracts 3, 4 and 5: stages 17 to 40, for good.`
   - Purchase option: **buy**, not rent. Price about $1.99. Let Play convert the price
     for the other countries, then check a few by eye.
   - **Activate** the product. An inactive product does not come back from the query,
     and the game then shows UNLOCK with no price and answers NO ANSWER. TRY AGAIN.
5. [ ] **License testers.** Play Console (the account, not the app) → *Settings → License
   testing*. Add the Gmail address of each tester's phone. A license tester buys with a
   test card that is never charged, and the purchase sheet says so.
6. [ ] **A build in a test track.** Upload 1.1 to internal testing and install it from
   Play: Play answers billing for an app id that has a build with billing on a track, and
   the build Play installs is the one that is sure to match. The **sideload** build is a
   different app to Play (`com.warpvanguard.game.sideload`): it cannot buy. Use it for the
   R8 pass, not for purchases.
7. [ ] **Data safety form.** The play statistics now carry three paywall events (the offer
   opened, how a purchase or restore ended). Tick **Financial info → Purchase history**:
   collected, not shared, purpose *Analytics*. Nothing else changes: no price, receipt or
   store account is ever sent. `PLAY-STATISTICS-PRIVACY.md` has the reasoning.
8. [ ] **Store listing.** Paste the 1.1 copy from [STORE-MATERIALS.md](STORE-MATERIALS.md)
   §6. Play adds the *In-app purchases* label by itself.
9. [ ] **The content questions.** In [PLAY-CONSOLE-ANSWERS.md](PLAY-CONSOLE-ANSWERS.md), the
   *Does it allow purchases?* answer changes to **Yes** with 1.1.

## 2. App Store Connect

1. [ ] **The Paid Applications agreement.** App Store Connect → *Business* (the section
   was called *Agreements, Tax, and Banking*). Accept the Paid Apps agreement, then add the bank
   account and the tax forms. The agreement must show **Active** before a product can
   be sold, and before the sandbox can buy.
2. [ ] **EU trader status.** The EU Digital Services Act asks the same question on the App
   Store. The free versions could say non-trader; the 1.1 purchase makes you a
   **trader**. Apple shows a trader's address, phone number and email on the EU product
   page, and verifies them, so use the same phone and address as on Play. Change it
   before the 1.1 purchase goes live in the EU. Look in *Business*; the exact menu path
   was not checked on 2026-11-05.
3. [ ] **The in-app purchase.** The app → *Monetization → In-App Purchases → +*.
   - Type: **Non-Consumable**.
   - Reference name: for example `Deep Space Clearance` (only you see it)
   - Product ID: `com.warpvanguard.game.license`
   - Price: the tier nearest $1.99. Check the other storefronts.
   - Localization: display name and description, the same words as on Play.
   - **Family Sharing**: your choice. On means one purchase covers the family. Once on,
     it cannot be turned off.
4. [ ] **The review screenshot.** Every new in-app purchase needs one screenshot for the
   reviewer, of the purchase in the app. Use the offer disc: open contract 3 on the
   carousel and tap GET CLEARANCE. On a web build, `index.html?paywall=fresh` shows the
   free tier even on a save that has the unlock. The screenshot is for review only; it is
   never shown on the store.
5. [ ] **Submit the product with the build.** The first in-app purchase must go to review
   with a new app version: on the 1.1 version page, add the product under *In-App
   Purchases and Subscriptions* before you submit.
6. [ ] **App Privacy (the privacy label).** Add **Purchases → Purchase History**: purpose
   *Analytics*, *Linked to the user*, not used for tracking. It is the paywall's three
   events in the play statistics, as on Play.
7. [ ] **Review notes.** Paste the 1.1 notes from
   [APP-STORE-REVIEW-NOTES.md](APP-STORE-REVIEW-NOTES.md) (*1.1: the in-app purchase*).
8. [ ] **Sandbox testers.** *Users and Access → Sandbox → Test accounts → +*. Use an email
   address that is not an Apple Account already (a `+sandbox` alias works). On the test
   iPhone: *Settings → Developer → Sandbox Apple Account* (on older iOS: *Settings → App
   Store → Sandbox Account*), then sign in there, never in the main Apple Account field.
   A TestFlight build buys in the sandbox by itself, with no tester account at all.
9. [ ] **Store listing.** Paste the 1.1 promotional text and description from
   [STORE-MATERIALS.md](STORE-MATERIALS.md) §6. The App Store shows *In-App Purchases*
   on the listing by itself.

## 3. Before the 1.1 cut

1. [x] **The two decisions** (answered 2026-11-05, one line each in `src/game/34-license.js`):
   `WEEKLY_NEEDS_LICENSE = false` ("Weekly stays free") and `GRANDFATHER = 'progress'`
   ("Keep their progress": a save with progress past stage 16 keeps stages 17–40).
2. [ ] **One real purchase on each platform**, with a license tester on Android and a
   sandbox account on iOS: buy, kill the app, start it again (still unlocked), delete
   the app and install it again (unlocked again, at start-up, with no tap), and RESTORE
   PURCHASE in settings.
3. [ ] **One gift code on each platform** (§4): leave the game open on the contract
   carousel, switch to the store app, redeem the code, switch back. Contracts 3–5 open
   without a restart. On iOS, test with a sandbox offer code first.
4. [ ] **One cancelled purchase and one slow card.** Play's test cards include *slow
   card, approves after a few minutes*: the disc says CLEARANCE PENDING, and the stages
   open by themselves when it clears.
5. [ ] **The R8 device pass** on the sideload build (`npm run aab` makes it): the new
   plugin is found by reflection, like every Capacitor plugin.
6. [ ] **The privacy page** (`docs/privacy.html`) has a *Purchases* section. Push it
   with 1.1, not before you want it public.
7. [ ] **The verifier.** The paywall moves the sim id (any byte does), so the verifier
   deploys before the build ships, as for every change under `src/game/`.

## 4. Gift codes: for you, family and friends

A gift is a **store code**, made in the console and redeemed in the store's own app.
The game needs nothing typed into it: it asks the store at start-up, each time it comes
back to the screen, when the offer opens, and on RESTORE PURCHASE, and the unlock is
there. The person needs the 1.1 build (the first one with the unlock) on their phone.

**Never an unlock code typed into the game.** App Store guideline 3.1.1 forbids an app's
own mechanism to unlock content (license keys, codes), and a code in the game would be
plain text in the bundle for anyone to read.

### Android: promo codes

1. [ ] Play Console → the app → *Monetize with Play → Promotions* → create a promotion
   for the one-time product `com.warpvanguard.game.license`.
2. [ ] Pick one-time codes (one per person) and the start and end dates.
3. [ ] Send each person one code. They redeem it in the Play Store app (the profile menu,
   *Redeem code*), or with the link the console gives.

Limit: **500 codes a quarter**, shared by every non-subscription promotion of the app.
Unused codes do not carry over to the next quarter.

### iOS: offer codes

1. [ ] App Store Connect → the app → the in-app purchase → *Offer Codes* → create an
   offer of **one-time use codes**. The in-app purchase must be live on the store first.
2. [ ] Redeem one yourself before you send a batch: a developer forum post reports
   "offer not available" for a production code.
3. [ ] Send each person one code. They redeem it in the App Store app (the account
   picture, *Redeem Gift Card or Code*), or with the link App Store Connect gives.

Apple stopped new **promo codes** for in-app purchases on 26 March 2026; offer codes
replace them and now cover a non-consumable. Promo codes for the app itself still exist,
but the app is free, so they unlock nothing here.

### iOS: Family Sharing

Turn on *Family Sharing* on the in-app purchase, and one purchase covers everyone in the
buyer's Apple family group. **Once on, it cannot be turned off.** Google Play has no
equivalent: its Family Library does not share in-app purchases.

### You

Your own save from before the paywall keeps contracts 3–5 on every device that holds it
(`GRANDFATHER`). A new phone with no save needs a code like anyone else.

