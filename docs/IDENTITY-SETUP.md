# Identity Setup — Detailed Step-by-Step (everything on YOUR end)

> ## ⚠️ SUPERSEDED (2026-07-25) — accounts were cancelled
> Data Defenders went **anonymous / 80s-arcade**: no Google/Apple/email sign-in,
> no unique operator names, no account deletion. Almost everything below (setting
> up OAuth providers, redirect URLs, the `delete-account` flow, name uniqueness)
> is **no longer needed**. The only dashboard work that still matters:
> - **Authentication → keep _Anonymous sign-ins_ ON** (the server-verified player_id) and **CAPTCHA OFF**.
> - Run **`supabase/migrate-anonymous.sql`** in the SQL Editor (drops `profiles` + the name/account RPCs, switches the reads/writes to the anonymous model, adds the top-100 cap).
> - The display name is now a **free-typed handle**, moderated at write time by the `submit-run` Edge Function — nothing to configure in the dashboard.
>
> Kept for historical reference only.

This is the **dashboard / console** work only you can do. All the **code** is already
built (see [LEADERBOARDS-SETUP.md](LEADERBOARDS-SETUP.md)). Follow this top to bottom.
It assumes no prior Supabase experience and explains where each thing lives and what
you should see when it works. Tick each box as you go.

---

## Orientation — the three places you'll work

You'll bounce between three websites (plus, near the end, your terminal):

1. **Supabase Dashboard** — <https://supabase.com/dashboard> → click your project.
   This is where your database and login settings live. On the **left sidebar** you'll
   use these icons/sections a lot:
   - **SQL Editor** (looks like `>_` or "SQL") — run database commands.
   - **Table Editor** — browse your data like a spreadsheet.
   - **Authentication** — everything about how players log in (this has its own
     sub-menu once you click it: *Users*, *Policies*, *Sign In / Providers*,
     *Email Templates*, *URL Configuration*).
   - **Project Settings** (gear icon, bottom) — API keys, SMTP, etc.
2. **Google Cloud Console** — <https://console.cloud.google.com> (only for Step 4).
3. **Apple Developer** — <https://developer.apple.com/account> (only for Step 5).

**Terms you'll see, in plain English:**
- **Schema** = the definition of your database tables and functions. `schema.sql` is a
  text file of commands that *creates* them.
- **RPC** = a database function the app can call over the internet (e.g. "give me the
  top 100 scores"). You don't do anything special for these — running the schema
  creates them.
- **RLS (Row-Level Security)** = the rule that stops players from writing scores
  directly. Already handled by the schema.
- **Provider** = a way to log in (Anonymous, Email, Google, Apple).
- **Service role key** = a *secret* master key that bypasses all security. Never put it
  in the game code; only in server-side functions.

**Your constants** (already wired into the app — copy these verbatim wherever a step
asks for them):

| Thing | Value |
|---|---|
| Supabase project ref | `ghkbjlgcdrszkawfbxdr` |
| Supabase URL | `https://ghkbjlgcdrszkawfbxdr.supabase.co` |
| **OAuth callback** (Google & Apple both use this) | `https://ghkbjlgcdrszkawfbxdr.supabase.co/auth/v1/callback` |
| App bundle / package ID | `com.datadefenders.game` |
| Native deep-link (OAuth return) | `datadefenders://auth` |

**Accounts you'll need:** Supabase (have it), a Google account (free), and — only for
Apple sign-in / iOS — an **Apple Developer Program** membership ($99/yr). Everything
except Apple is free.

**You don't have to do it all at once.** Steps 1–3 (schema + anonymous + email) give you
a fully working, testable login system with **no external consoles and no money**. Do
those first. Google/Apple (4–6) and the native app (7) can come later.

---

## Step 1 — Run the (updated) schema  ☐

**What this does:** creates/updates the database tables and functions the leaderboard
needs. I recently added a `profiles` table (for unique operator names), so even if you
ran the schema before, you need to run it again. It's safe to re-run — every command is
written as "create only if it doesn't already exist," so nothing gets wiped.

**Where/how:**
1. Open the **Supabase Dashboard** → click your project.
2. Left sidebar → **SQL Editor**.
3. Click **+ New query** (top area). You get an empty text box.
4. Open the file [supabase/schema.sql](../supabase/schema.sql) from this repo in your
   code editor, **select all** the text (Cmd/Ctrl-A), **copy** it.
5. **Paste** it into the Supabase SQL Editor box.
6. Click the green **Run** button (bottom-right of the editor, or press Cmd/Ctrl-Enter).

**What success looks like:** a green "Success. No rows returned" message, no red errors.

**Verify it worked:** left sidebar → **Table Editor** → in the table dropdown you should
now see **two** tables: `runs` and `profiles`. If you only see `runs`, the paste was
incomplete — re-copy the whole file and run again.

---

## Step 2 — Turn on Anonymous sign-in  ☐

**What this does:** lets anyone play and get a provisional rank instantly, with no login.
It's also the session the app uses to talk to the server before someone signs in.

**Where/how:**
1. Left sidebar → **Authentication**.
2. In the Authentication sub-menu → **Sign In / Providers** (older UI calls it
   **Providers**).
3. Find **Anonymous sign-ins** in the list → click it / toggle it **ON**.
4. Click **Save** if there's a save button.

**What success looks like:** the Anonymous row shows "Enabled." That's all — nothing to
test yet; it works silently in the background.

> FYI: every anonymous player becomes a row in your users list (Authentication →
> **Users**). That's expected and harmless. Much later you can clean out old anonymous
> users, but you don't need to think about it now.

---

## Step 3 — Email sign-in with a 6-digit code  ☐

**What this does:** lets someone sign in by typing their email, getting a code, and
entering it. The app is built for a **code**, not a "click this link" email — so you
have to tell Supabase to send the code.

> **Heads-up:** Supabase only lets you **customize the email template if you've
> connected your own email sender (custom SMTP)**. Its built-in sender can't be
> re-templated and is rate-limited to a handful of messages/hour (test-only). So the
> code below sets up a free sender (Resend) **first**, then edits the template. This is
> needed for launch regardless. **In a hurry?** Skip Step 3 for now and test with
> **Google** (Step 4) or **Anonymous** — neither needs SMTP.

### 3a. Enable the Email provider
1. **Authentication** → **Sign In / Providers** → click **Email**.
2. Make sure **Email** is **Enabled**.
3. Turn on **Confirm email** (so new emails are verified). Password login can stay on or
   off — the app doesn't use it.
4. **Save**.

### 3b. Connect a free email sender (Resend SMTP) — required to edit the template
Any SMTP provider works (SendGrid, Postmark, Mailgun…); Resend is the quickest free one.
1. Sign up at <https://resend.com> (free tier).
2. **For testing** you can send to *your own* address immediately using their sandbox
   sender `onboarding@resend.dev` — no domain needed. **For launch**, add and verify your
   own domain (Resend → **Domains** → add DNS records they show you) so you can send from
   e.g. `noreply@yourdomain`.
3. Resend → **API Keys** → **Create API Key** → copy it (starts with `re_...`).
4. In Supabase → **Project Settings** (gear, bottom of sidebar) → **Authentication** →
   scroll to **SMTP Settings** → toggle **Enable Custom SMTP** and fill:
   - **Sender email**: `onboarding@resend.dev` (testing) or your verified address (launch)
   - **Sender name**: `Data Defenders`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: your Resend API key (`re_...`)
5. **Save**.

### 3c. Make the email actually contain the code
Now that custom SMTP is on, the template editor is unlocked.
1. **Authentication** → **Email Templates**.
2. Select the **Magic Link** template (this is the one used for email codes).
3. You'll see an HTML editor. Replace its contents with something like this:
   ```html
   <h2>Your Data Defenders code</h2>
   <p>Enter this code to sign in:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>This code expires in 1 hour.</p>
   ```
   The important part is **`{{ .Token }}`** — that placeholder is what Supabase replaces
   with the real 6-digit code. Leave it spelled exactly like that (dot before `Token`).
4. **Save**.

### 3d. Test it right now
1. Run the game (`npm run dev`, then open the URL it prints — see the box at the end of
   this doc if you're unsure how).
2. Tap the **operator button** (person icon, top-right of the home screen, next to the
   gear).
3. Tap **EMAIL** → type your email → **SEND**.
4. Check your inbox (and spam) for the code → type it in → **VERIFY**.
5. You should end up signed in, with the name field now editable. Type a name → **CLAIM**.

> If using the `onboarding@resend.dev` sandbox sender, you can only email **your own**
> Resend-account address until you verify a domain. That's fine for testing.

---

## Step 4 — Google sign-in  ☐

This has two halves: create login credentials in **Google Cloud Console**, then paste
them into **Supabase**.

### 4a. Set up the Google "consent screen" (the permission popup users see)
> Google recently renamed this area to **Google Auth Platform**. Instead of a one-time
> wizard it's now a set of tabs on the left: **Overview / Branding / Audience / Clients
> / Data Access**. The steps below map to those tabs.
1. Go to <https://console.cloud.google.com>. If prompted, create a project (top bar →
   project dropdown → **New Project** → name it "Data Defenders" → Create). Make sure
   that project is selected in the top bar.
2. Left menu (hamburger ☰) → **APIs & Services** → **OAuth consent screen** (this opens
   the Google Auth Platform tabs). If it asks, choose User type **External** → Create.
3. **Branding** tab → **App name** = `Data Defenders`, **User support email** = your
   email, **Developer contact email** = your email → **Save**.
4. **Audience** tab → under **Test users** → **Add users** → add your own Gmail address
   (while the app is "Testing", only listed testers can sign in) → **Save**.
5. **Data Access** tab (this is the *scopes* page) → **Add or remove scopes** → check
   `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid` → **Update** →
   **Save**. *(Optional — these are non-sensitive defaults Supabase requests
   automatically. If you can't find them or want to move fast, skip this step.)*

### 4b. Create the OAuth client (the actual ID + secret)
1. **APIs & Services** → **Credentials**.
2. Top → **+ Create Credentials** → **OAuth client ID**.
3. **Application type** → **Web application**. Give it a name (e.g. "Supabase web").
4. Under **Authorized redirect URIs** → **+ Add URI** → paste exactly:
   ```
   https://ghkbjlgcdrszkawfbxdr.supabase.co/auth/v1/callback
   ```
   (This is where Google sends the user back after they approve. It must match exactly.)
5. Click **Create**. A popup shows your **Client ID** and **Client secret** — keep this
   open, or copy both somewhere safe.

### 4c. Paste them into Supabase
1. Supabase → **Authentication** → **Sign In / Providers** → click **Google** → enable.
2. Paste **Client ID** into the Client ID field and **Client secret** into the Client
   Secret field.
3. **Save**.

**Test:** operator button → **GOOGLE** → you're sent to Google's approval page → approve
→ you land back in the game, signed in → claim a name.

> Why only a "Web" client and no separate Android/iOS one? The app opens Google's login
> in a browser and comes back through Supabase — so the single Web client covers the web
> PWA *and* both phone apps. Less to manage.

---

## Step 5 — Apple sign-in  ☐  *(needs the paid Apple Developer Program; required for iOS)*

Apple's setup is the fussiest. Everything here is at
<https://developer.apple.com/account> → **Certificates, Identifiers & Profiles**
(left menu). You'll create four things: an **App ID**, a **Services ID**, a **Key**, and
you'll note your **Team ID** — then paste them into Supabase.

### 5a. App ID (skip if `com.datadefenders.game` already exists)
1. **Identifiers** → blue **+** → **App IDs** → **App** → Continue.
2. **Description**: `Data Defenders`. **Bundle ID**: `com.datadefenders.game` (Explicit).
3. Scroll to **Capabilities**, check **Sign In with Apple**.
4. **Continue** → **Register**.

### 5b. Services ID (this is your Apple "Client ID" for login)
1. **Identifiers** → **+** → **Services IDs** → Continue.
2. **Description**: `Data Defenders Web`. **Identifier**: `com.datadefenders.game.web`
   → Continue → **Register**.
3. Click the Services ID you just made → check **Sign In with Apple** → **Configure**:
   - **Primary App ID**: choose `com.datadefenders.game`.
   - **Domains and Subdomains**: `ghkbjlgcdrszkawfbxdr.supabase.co`
   - **Return URLs**: `https://ghkbjlgcdrszkawfbxdr.supabase.co/auth/v1/callback`
   - **Next** / **Done** → **Continue** → **Save**.

### 5c. Key (a secret file Supabase uses to talk to Apple)
1. **Keys** (left menu) → **+**.
2. **Key Name**: `Data Defenders SignIn`. Check **Sign In with Apple** → **Configure** →
   pick Primary App ID `com.datadefenders.game` → **Save**.
3. **Continue** → **Register**.
4. Click **Download** — this saves a file ending in **`.p8`**. **You can only download it
   once**, so keep it safe. Also note the **Key ID** shown on this page (10 characters).
5. Note your **Team ID**: top-right of the developer portal, next to your name (10
   characters), or under **Membership**.

### 5d. Paste into Supabase
1. Supabase → **Authentication** → **Sign In / Providers** → click **Apple** → enable.
2. **Client IDs** (a.k.a. Services ID): `com.datadefenders.game.web`
   (If a field for it exists, you can also add the bundle ID `com.datadefenders.game`
   for future native iOS sign-in — optional now.)
3. **Secret Key**: open the downloaded `.p8` file in a plain text editor (TextEdit,
   VS Code) and paste its **entire contents** (including the `-----BEGIN...` and
   `-----END...` lines).
4. If the form has separate boxes, also enter your **Team ID** and **Key ID** so Supabase
   can build the login secret automatically.
5. **Save**.

**Test:** operator button → **APPLE** → Apple's sign-in page → approve → back in the
game, signed in.

---

## Step 6 — Tell Supabase which return URLs are allowed  ☐  ← **the Google "localhost refused to connect" fix**

**Why:** for security, Supabase refuses to send a user back to any address that isn't on
an approved list. If the address the app asks for isn't listed, Supabase **silently
falls back to the Site URL** — which by default is `http://localhost:3000` and points
nowhere. That's the "This site can't be reached / localhost:3000" screen after Google.
Two things to get right: the **Site URL** and the **Redirect URLs**.

> **This game's dev server runs on port `8000`** (see `npm run dev` / `scripts/serve.js`),
> not 3000 — so the default Supabase Site URL is wrong out of the box and must be changed.

**Where/how:**
1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: set it to where the game actually runs. For desktop testing that's
   `http://localhost:8000`. (Later, your real hosting URL.)
3. **Redirect URLs** → add each of these (there's usually an **Add URL** button; add one
   per line):
   ```
   datadefenders://auth
   http://localhost:8000
   http://localhost:8000/**
   https://YOUR-REAL-WEB-HOST/**
   ```
   - **Test on your computer first** at `http://localhost:8000` — simplest, no LAN needed.
   - **Phone over Wi-Fi:** `localhost` is the *phone itself* and will always fail. Find
     your computer's LAN IP (`ipconfig getifaddr en0` on Mac → e.g. `192.168.1.42`), add
     `http://192.168.1.42:8000/**` here, and open the game on the phone at that IP:8000
     (not localhost).
   - `datadefenders://auth` is the one that makes the **native apps** come back — keep it
     exactly as written.
4. **Save**.

---

## Step 7 — Native deep link (only for the Android/iOS apps)  ☐

**Skip this entirely if you're only testing in a browser.** Email sign-in also needs none
of this — so test with email/Google in the browser first, then come back here when you
build the phone apps.

**What this does:** registers `datadefenders://` as a link the operating system knows
belongs to your app, so tapping the OAuth return re-opens the app instead of a browser.

### 7a. Add the Capacitor "App" plugin
This plugin lets the app catch the incoming link. In your terminal, from the project
folder:
```bash
npm i @capacitor/app
npm run sync
```
(`npm run sync` rebuilds the web files and copies them into the native Android/iOS
projects. It's defined in `package.json`.)

### 7b. Android
1. Open the file `android/app/src/main/AndroidManifest.xml` in your editor.
2. Find the `<activity>` block that contains `android.intent.category.LAUNCHER` (that's
   the app's main screen).
3. **Inside** that `<activity> ... </activity>`, paste this new block:
   ```xml
   <intent-filter>
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="datadefenders" android:host="auth" />
   </intent-filter>
   ```
4. Save.

### 7c. iOS
1. Open `ios/App/App/Info.plist` (either in a text editor, or in Xcode).
2. Add this entry (in a plain-text editor, paste it just before the final `</dict>`):
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>datadefenders</string></array>
     </dict>
   </array>
   ```
3. Save. (For a *native* Apple sign-in button later, you'd also add the "Sign In with
   Apple" capability in Xcode → your target → Signing & Capabilities. Not needed for the
   browser-based flow we use.)

### 7d. Re-sync so the changes reach the build
```bash
npm run sync
```

---

## Step 8 — Account-deletion function  ☐  *(do before you publish on the app stores)*

**Why:** the App Store and Google Play both require an in-app "delete my account" option
once you offer login. The app already deletes the player's *game data* (their name and
runs). This small server function deletes the underlying *login account* itself — which
needs the secret service-role key, so it must run on the server, not in the game.

**How (uses the Supabase command-line tool):**
1. Install and connect the CLI (one time). In your terminal:
   ```bash
   npm i -g supabase          # installs the 'supabase' command
   supabase login             # opens a browser to log in
   supabase link --project-ref ghkbjlgcdrszkawfbxdr
   ```
2. Create the function scaffold:
   ```bash
   supabase functions new delete-account
   ```
   This makes a folder `supabase/functions/delete-account/`.
3. Open `supabase/functions/delete-account/index.ts` and replace its contents with:
   ```ts
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   Deno.serve(async (req) => {
     const auth = req.headers.get('Authorization') ?? ''
     const url = Deno.env.get('SUPABASE_URL')!
     const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
     // figure out who is calling, from their login token
     const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
       global: { headers: { Authorization: auth } },
     })
     const { data: { user } } = await asUser.auth.getUser()
     if (!user) return new Response('unauthorized', { status: 401 })
     // delete that user with the master key
     const admin = createClient(url, service)
     const { error } = await admin.auth.admin.deleteUser(user.id)
     return new Response(error ? error.message : 'ok', { status: error ? 400 : 200 })
   })
   ```
4. Deploy it (Supabase provides the secret keys to it automatically):
   ```bash
   supabase functions deploy delete-account
   ```

**Until you do this:** the game's DELETE button still removes the player's name and runs
(via the database) — it just can't remove the login account itself, and fails quietly on
that part. Fine for testing; required before public launch.

---

## Step 9 — Full test checklist  ☐

**How to run the game:** in your terminal, from the project folder:
```bash
npm run dev
```
It builds the game and serves it on **port 8000** (`http://localhost:8000`). Open that in
a desktop browser. To test on your **phone** (same Wi-Fi), open `http://<your-computer-
LAN-IP>:8000` instead — `localhost` won't work from the phone — and make sure that exact
URL is in Step 6's redirect list.

Now walk through:

- ☐ Fresh load → the operator button shows you as `Defender-XXXXXX` (no signed-in dot).
- ☐ Play a ranked round → the END screen shows **"SIGN IN — CLAIM RANK #N"**.
- ☐ **Email**: SEND → code arrives → VERIFY → panel opens → claim a name → it sticks.
- ☐ **Google**: tap → approve → returns signed-in → claim a name.
- ☐ **Apple**: tap → approve → returns signed-in → claim a name.
- ☐ Uniqueness: try a name someone already took → the dot turns red, "name taken".
- ☐ **Sign out** → you're back to `Defender-XXXXXX`, and play still works.
- ☐ **Delete account** → confirm → data gone, back to anonymous.
- ☐ On a phone build: after Google/Apple, the app reopens itself and you're signed in.

> **One honest caveat:** signing in and claiming names works as soon as the steps above
> are done. But the leaderboards only start **filling with scores** once the separate
> **verifier function (phase 4)** is deployed — until then, score submissions fail
> quietly by design. Everything in *this* guide is testable now.
