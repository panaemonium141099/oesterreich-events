# fn-10-spotify-artist-alerts-follow-artists.10 Notification Preferences UI and Phone Number Management

## Description
Build the notification preferences UI where users can configure which channels they want for artist alerts (in-app, email, SMS) and provide a phone number for SMS.

**Size:** M
**Files:** `src/app/settings/notifications/page.tsx`, `src/app/api/notifications/preferences/route.ts`, `src/components/Settings/NotificationPreferences.tsx`

## Approach

- New settings page at `/settings/notifications`
- UI sections:
  1. **Kuenstler-Benachrichtigungen**: Master toggle for artist alerts
  2. **Kanaele**: Checkboxes for in-app (always on), email (off by default), SMS (off by default)
  3. **Telefonnummer**: Input field for SMS (E.164, with +43 prefix helper), only shown when SMS is enabled
- Email goes to the user Supabase Auth email -- no override field (single source of truth)
- API route `PUT /api/notifications/preferences` -- upsert notification_preferences row
- API route `GET /api/notifications/preferences` -- get current preferences
- Phone number validation: client-side format check + server-side E.164 validation
- GDPR: show consent text before enabling email/SMS
- Follow dark theme, German-language labels

## Key context

- No email_override in the schema -- Supabase Auth email is the single source of truth
- The notification_preferences table has a unique constraint on user_id -- use upsert (INSERT ON CONFLICT UPDATE)

## Acceptance
- [ ] Notification preferences page renders with channel toggles
- [ ] In-app channel is always enabled (not toggleable)
- [ ] Email and SMS channels default to off
- [ ] Phone number input shown only when SMS is enabled
- [ ] Phone number validated as E.164 format
- [ ] GDPR consent text shown before enabling email/SMS
- [ ] Email sent to Supabase Auth email (no override field)
- [ ] Preferences saved via API route with upsert
- [ ] Preferences loaded on page mount
- [ ] German-language UI
- [ ] Link from artist management and profile pages

## Done summary
Added notification preferences UI at /settings/notifications with API routes (GET/PUT), GDPR consent dialogs for email/SMS, phone number input with E.164 validation, always-on in-app channel, and navigation links from profile and artist management pages.
## Evidence
- Commits: 1457ad26c0552c7f7d3bcae7fac67cc846848c8d
- Tests: npx tsc --noEmit, npm test
- PRs: