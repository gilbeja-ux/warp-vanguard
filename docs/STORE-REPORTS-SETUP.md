# Store reports — the credentials the traction page needs

Installs exist only in the stores. The traction page (`npm run admin`, then
http://localhost:8200/traction) pulls them with two read-only credentials that
only Gil can make. This is the exact list. Until the keys exist, the page takes a
file upload instead (the last section).

Everything lands in **`~/.warp-vanguard/`**, outside every checkout, so no key can
be committed and removing a worktree loses nothing. Set `WV_TRACTION_DIR` to move
it. The admin console reads the files; nothing but per-day counts reaches the
browser.

```bash
mkdir -p ~/.warp-vanguard && chmod 700 ~/.warp-vanguard
```

## Google Play — installs from the reports bucket

Play writes its install statistics as monthly CSV files into a Google Cloud
Storage bucket that belongs to the developer account. A service account with
read access to that bucket is all the importer needs. (The Play Developer
Reporting API covers crash and ANR rates, not installs, so it is not used here.)

1. **Find the bucket.** Play Console → **Download reports** → **Statistics**.
   Press **Copy Cloud Storage URI**. It looks like
   `gs://pubsite_prod_rev_01234567890123456789/stats/installs/`. Keep the
   `pubsite_prod_rev_…` part.
2. **Make a Google Cloud project**, or use one you have:
   https://console.cloud.google.com → project picker → **New project** →
   `warp-vanguard-reports`. No billing account is needed.
3. **Make the service account.** In that project: **IAM & Admin** →
   **Service Accounts** → **Create service account** → name `play-reports` →
   **Create and continue** → grant it **no** project role → **Done**.
4. **Make its key.** Open `play-reports` → **Keys** → **Add key** →
   **Create new key** → **JSON** → **Create**. A JSON file downloads. Move it:
   ```bash
   mv ~/Downloads/warp-vanguard-reports-*.json ~/.warp-vanguard/play-service-account.json
   ```
   ```bash
   chmod 600 ~/.warp-vanguard/play-service-account.json
   ```
5. **Let it into Play Console.** Play Console → **Users and permissions** →
   **Invite new users**. Email address: the service account's address
   (`play-reports@warp-vanguard-reports.iam.gserviceaccount.com`, shown on its
   page). Under **Account permissions** tick only **View app information and
   download bulk reports (read-only)**. **Invite user**.
6. **Wait up to 24 hours.** Play takes that long to open the bucket to a new
   account. A sync before then answers 403.
7. **Write the config.** `~/.warp-vanguard/store.json`:
   ```json
   {
     "play": {
       "bucket": "pubsite_prod_rev_01234567890123456789",
       "package": "com.warpvanguard.game",
       "keyFile": "play-service-account.json"
     }
   }
   ```
8. **Sync.** The traction page → **Sync Play**. It reads the last fourteen
   monthly `installs_…_overview.csv` files. Play's numbers run two to three days
   behind.

If a sync says the *Cloud Storage JSON API* is disabled, enable it in the same
Google Cloud project (**APIs & Services** → **Enable APIs** → *Cloud Storage
JSON API*).

**To revoke:** remove the user in Play Console, then delete the key in Google
Cloud.

## App Store — downloads from Sales and Trends

Apple publishes one sales report per day, the day after, around 5 am Pacific.
First-time downloads, re-downloads, updates and in-app purchases are all in it,
so the same key will count the paywall's purchases later.

1. **Open the API keys.** App Store Connect → **Users and Access** →
   **Integrations** → **App Store Connect API** → **Team Keys**. The first time,
   the Account Holder presses **Request Access** and accepts the terms.
2. **Make the key.** Press **+** (*Generate API Key*). Name `traction-portal`.
   Access: **Sales**. That is the narrowest role that can read Sales and Trends;
   Finance and Admin also work and can do far more. **Generate**.
3. **Download it — once.** Press **Download API Key**. Apple offers the `.p8`
   file one time only. Move it:
   ```bash
   mv ~/Downloads/AuthKey_*.p8 ~/.warp-vanguard/
   ```
   ```bash
   chmod 600 ~/.warp-vanguard/AuthKey_*.p8
   ```
4. **Copy two ids from the same page:** the **Key ID** (its column in the keys
   table) and the **Issuer ID** (above the table).
5. **Find the vendor number.** App Store Connect → **Payments and Financial
   Reports**: the number at the top left, eight digits starting with 8. (Sales
   and Trends → **Reports** shows it too.)
6. **Write the config** — the same `~/.warp-vanguard/store.json`, beside the
   `play` block:
   ```json
   {
     "appstore": {
       "issuerId": "69a6de70-0000-47e3-e053-5b8c7c11a4d1",
       "keyId": "ABCDE12345",
       "vendor": "80000000",
       "keyFile": "AuthKey_ABCDE12345.p8"
     }
   }
   ```
7. **Sync.** The traction page → **Sync App Store**. The first sync reads the
   last ninety days, one request per day; later syncs read only the days since.

**To revoke:** App Store Connect → the same Team Keys table → **Revoke**.

## Before the keys exist: upload a file

The traction page's **Upload** takes any of these, and detects which:

| File | Where to get it |
|---|---|
| Play installs overview CSV | Play Console → **Download reports** → **Statistics** → pick the month → **Installs** → the *overview* file. It is the same file the bucket holds. |
| App Store daily sales report | App Store Connect → **Sales and Trends** → **Reports** → *Sales*, *Summary*, *Daily*, pick a day → **Download**. Upload the `.txt.gz` as it is. |
| App Store Connect analytics export | App Store Connect → **App Analytics** → **Metrics** → *First-Time Downloads* → export CSV. Pick **App Store** in the store menu before uploading. |
| Any two-column CSV | a `date` column and a count. Pick the store first. |

A day uploaded twice keeps the newest numbers. A slashed date is read month
first, as Apple writes it.
