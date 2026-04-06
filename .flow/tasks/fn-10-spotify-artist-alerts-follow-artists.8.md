# fn-10-spotify-artist-alerts-follow-artists.8 Email Notification Service with Resend Integration

## Description
Integrate Resend for email notifications. Build conversion-optimized email templates for artist alerts with prominent ticket purchase CTAs. Include GDPR-compliant unsubscribe mechanism.

**Size:** M
**Files:** `src/lib/email.ts`, `src/lib/notification-sender.ts` (update), `src/emails/artist-alert.tsx` (React Email template), `src/emails/artist-reminder.tsx`

## Approach

- Install `resend` npm package
- Create `src/lib/email.ts` with `sendArtistAlertEmail()` and `sendArtistReminderEmail()` functions
- Two email templates (conversion-optimized):
  1. **Discovery email** (`artist-alert.tsx`): "{Artist} tritt in {Location} auf!"
     - Hero: artist image + event title
     - Event details: date, time, venue, location
     - Primary CTA button: "Tickets sichern" (links to `ticket_url` or event page)
     - Secondary link: "Event-Details ansehen" -> `/events/{id}`
     - Footer: unsubscribe link, notification preferences link
  2. **Reminder email** (`artist-reminder.tsx`): "In {N} Tagen: {Artist} live!"
     - Urgency header for 1d reminder: "Morgen ist es soweit!"
     - Same CTA structure but with urgency-driven copy
     - For 7d: "Sichere dir jetzt deine Tickets"
     - For 1d: "Letzte Chance -- Tickets sichern!"
- Unsubscribe link: `/api/notifications/unsubscribe?token=<jwt>` -- sets `channel_email=false`
- Wire into `notification-sender.ts`: check `channel_email=true` before sending
- Env var: `RESEND_API_KEY`
- From address: `alerts@osterreich.events`
- Error handling: retry up to 3 times with exponential backoff

## Key context

- `ticket_url` on events may be NULL -- show "Event-Details ansehen" linking to `/events/{id}` when no ticket URL
- Use `fetch()` directly instead of npm package for Deno compatibility in Edge Functions
- GDPR/DSGVO: email opt-in must be explicit (off by default)
- Email is the second-highest conversion channel after the "Meine Artist-Events" page

## Acceptance
- [ ] Discovery email template with artist image, event details, and ticket CTA
- [ ] Reminder email template with urgency-driven copy (7d and 1d variants)
- [ ] Primary CTA links to ticket_url when available, event page otherwise
- [ ] Unsubscribe link in every email
- [ ] `notification-sender.ts` checks `channel_email` preference before sending
- [ ] Retry logic: 3 attempts with exponential backoff on failure
- [ ] Works in both Deno (Edge Function) and Node.js environments
- [ ] `RESEND_API_KEY` env var documented
- [ ] No emails sent to users who have not explicitly opted in

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
