# Google Search Console API — Setup Guide (lasstreffen.at)

fn-13 Phase 10 consumes Search Console data (indexed URLs, keyword
impressions, CTR, avg position) via the **existing Google Cloud
service-account** that was set up for the Indexing API
(`GOOGLE_INDEXING_API_SA_KEY` — already in Vercel env).

The same JSON key works for Search Console too — Google service
accounts aren't scoped to a single API. You just need to enable the
GSC API in the GCP project and add the service-account email as a
user on the GSC property.

**Takes**: ~3 minutes.

---

## Step 1 — Enable the Search Console API in GCP

1. Pull up the existing service-account JSON key, look at `project_id`
   (e.g. `lasstreffen-XXXXXX`).
2. Go to the API library for that project:
   https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
3. Pick the right project in the top bar (matches `project_id`).
4. Click **Enable**.

## Step 2 — Add the service-account email as a user on the GSC property

1. Open the existing service-account JSON key, copy the `client_email`
   value. It looks like
   `indexing@lasstreffen-xxxxxx.iam.gserviceaccount.com` (or similar).
2. https://search.google.com/search-console → pick the `lasstreffen.at`
   domain property → **Settings** → **Users and permissions**.
3. **Add user** → paste the service-account email → Permission:
   **Restricted** (read-only is enough; we never write to GSC).

Done. The `/admin/seo` dashboard will now pull GSC data.

---

## CrUX API key (separate from GSC)

Chrome UX Report API is a different Google product (real-user Core Web
Vitals field data) and needs its own API key. **Free tier, no OAuth.**

1. https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com
   → same GCP project → **Enable**.
2. https://console.cloud.google.com/apis/credentials → **+ Create
   Credentials** → **API key** → copy the `AIza…` value.
3. (Optional but good practice) Click the new key → **Edit** → **API
   restrictions** → restrict to "Chrome UX Report API".
4. Add to Vercel → Project Settings → Environment Variables (all three
   envs: Production / Preview / Development):

       CRUX_API_KEY=AIza…

---

## Verify

The `/admin/seo` dashboard renders setup-status banners:
- **Green** when the service account can see the lasstreffen.at GSC
  property (Step 2 complete)
- **Yellow warning** when the API isn't enabled (Step 1 missed) or the
  service account wasn't granted access

Once both green:
- Click **Snapshot jetzt** once to pull fresh data without waiting for
  the 06:00 UTC daily cron
- Overview tiles + keywords + pages populate within ~5 seconds

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| "User does not have sufficient permission for site" | Service account not added to GSC property | Step 2 |
| "API searchconsole.googleapis.com has not been used in project" | Step 1 skipped | Step 1 |
| "Request had invalid authentication credentials" | JSON key was mangled in the env var | Re-paste entire JSON as one line |
| CrUX returns 404 for some hubs | Insufficient field data (new/low-traffic pages) | Nothing — dashboard handles it gracefully |
| Setup done but dashboard still shows "No data" | Daily cron hasn't fired yet | Click "Snapshot jetzt" manually |

---

## Env vars summary

| Name | What | Status on this project |
|---|---|---|
| `GOOGLE_INDEXING_API_SA_KEY` | Service-account JSON — used for Indexing + Search Console APIs | **Already set** (Vercel) |
| `CRUX_API_KEY` | Plain API key for Chrome UX Report API | **Missing — add via Step "CrUX API key" above** |
| `CRON_SECRET` | Bearer token Vercel Cron sends on scheduled hits | Already set |
| `ALERT_EMAIL` | Destination for weekly report + traffic-drop alerts | Already set (from fn-10) |
| `RESEND_API_KEY` | Resend send-email API key | Already set (from fn-10) |
