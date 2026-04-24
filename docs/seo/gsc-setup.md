# Google Search Console API — Setup Guide

fn-13 Phase 10 consumes Search Console data (indexed URLs, keyword
impressions, CTR, avg position) via a **service account**. This guide
walks through the one-time Google Cloud setup.

**Takes**: ~10 minutes.
**Prerequisite**: the site `lasstreffen.at` must already be verified in
Search Console (we verified it in Phase 0).

---

## 1. Create / pick a Google Cloud project

1. Open https://console.cloud.google.com/projectcreate
2. Name: `lasstreffen-seo` (or any existing project works)
3. Note the **Project ID** — used in `gcloud` commands later

## 2. Enable the Search Console API

1. https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
2. Make sure the right project is picked in the top bar
3. Click **Enable**

## 3. Enable the Chrome UX Report API

Separate API — needed for CrUX Core Web Vitals widget on the dashboard.

1. https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com
2. Click **Enable**

## 4. Create a service account

1. https://console.cloud.google.com/iam-admin/serviceaccounts
2. **+ Create service account**
   - Name: `lasstreffen-seo-reader`
   - Description: `Search Console + CrUX readonly for lasstreffen.at admin dashboard`
3. Skip the optional "grant access" steps (service-account needs no
   project-level IAM roles for the APIs we use)

## 5. Generate a JSON key for the service account

1. Click the new service account → **Keys** tab
2. **Add Key** → **Create new key** → **JSON** → **Create**
3. Save the downloaded `.json` file somewhere safe — treat it like a
   password. Never commit it.

## 6. Add the service account as a user on the Search Console property

This is the step most people forget — without it, API calls return 403.

1. Open the JSON key file, copy the `client_email` value. Looks like
   `lasstreffen-seo-reader@your-project-id.iam.gserviceaccount.com`.
2. Go to https://search.google.com/search-console → pick the
   `lasstreffen.at` domain property → **Settings** → **Users and
   permissions**
3. **Add user** → paste the service-account email, permission
   **Restricted** (read-only is fine, we only ever read).

## 7. Get a CrUX API key

1. https://console.cloud.google.com/apis/credentials
2. **+ Create Credentials** → **API key**
3. Copy the key (starts with `AIza…`)
4. Optional: click the key → **Edit** → **API restrictions** → restrict
   to the Chrome UX Report API, save. Good hygiene.

## 8. Wire into Vercel

Two env vars go into **Vercel → Project → Settings → Environment
Variables** (all three environments: Production, Preview, Development):

```
GOOGLE_SEARCH_CONSOLE_SA_KEY='{"type":"service_account","project_id":"…","private_key":"…","client_email":"…",…}'
CRUX_API_KEY=AIza…
```

**For `GOOGLE_SEARCH_CONSOLE_SA_KEY`**: paste the *entire* JSON key
file's contents as one line, wrapped in single quotes. Vercel
preserves the embedded `\n` in the `private_key` field correctly — no
need to escape further.

**Local dev**: same two vars in `.env.local`.

## 9. Verify the setup

The admin dashboard at `/admin/seo` will render a setup-required banner
if either env var is missing. Once both are set:

- Dashboard → Setup Status section shows a green "GSC reachable" row
  with the number of verified sites the service account can see
  (should be ≥1 — the `lasstreffen.at` domain property)
- Daily-snapshot cron (`/api/cron/seo-daily-snapshot`) will produce a
  populated `seo_snapshots` row on its next run

## 10. Gotchas

- **"User does not have sufficient permission for site"**: the service
  account email was not added to the GSC property (step 6).
- **"Request had invalid authentication credentials"**: the
  `private_key` in the JSON got mangled on paste. The JSON must be
  valid — try `echo "$GOOGLE_SEARCH_CONSOLE_SA_KEY" | jq .` locally.
- **"API searchconsole.googleapis.com has not been used in project"**:
  step 2 was skipped, or a different project is picked in the service
  account's `project_id`.
- **CrUX returns 404**: origin or URL has insufficient field data —
  common for new / low-traffic pages. The dashboard handles this
  gracefully; no action needed.
