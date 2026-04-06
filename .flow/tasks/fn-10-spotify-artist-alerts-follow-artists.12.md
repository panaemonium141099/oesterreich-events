# fn-10-spotify-artist-alerts-follow-artists.12 Event Reminder System: Scheduled Reminders 7d and 1d Before Events

## Description
Build a conversion-driven reminder system that sends scheduled notifications before matched events. When an artist-event match is found, schedule reminders at 7 days and 1 day before the event. Each reminder includes a prominent ticket purchase CTA. Users can configure reminder frequency in their preferences.

**Size:** M
**Files:** `supabase/functions/send-reminders/index.ts`, `src/lib/notification-sender.ts` (update), migration for `event_reminders` table and pg_cron job, `src/components/Settings/NotificationPreferences.tsx` (update)

## Approach

- New `event_reminders` table:
  - `id`, `user_id`, `event_id`, `artist_name`, `reminder_type` (discovery | 7d_before | 1d_before), `scheduled_for` (timestamptz), `sent` (boolean), `sent_at`, `created_at`
  - Unique on `(user_id, event_id, reminder_type)` -- no duplicate reminders
- When matching pipeline (task .7) creates an artist_event_notification:
  1. Insert `discovery` reminder (sent immediately -- this is the existing notification)
  2. Insert `7d_before` reminder (scheduled_for = event.start_date - 7 days)
  3. Insert `1d_before` reminder (scheduled_for = event.start_date - 1 day)
  - Skip if event is < 7 days away (only create applicable reminders)
  - Skip if event is < 1 day away (only discovery notification)
- New Edge Function `send-reminders`:
  - pg_cron runs every hour (`0 * * * *`)
  - Queries `event_reminders WHERE sent = false AND scheduled_for <= now()`
  - Sends notification via notification-sender (in-app, email, SMS based on preferences)
  - Marks as `sent = true, sent_at = now()`
- Reminder content (conversion-focused):
  - **7d_before**: "In einer Woche: {artist} bei {event}! Sichere dir jetzt Tickets: {ticket_url}"
  - **1d_before**: "Morgen: {artist} live! Letzte Chance fuer Tickets: {ticket_url}"
  - Email: large CTA button "Tickets sichern" linking to ticket_url or event page
  - SMS: short format with ticket link
- Notification preferences update:
  - Add `reminder_7d` (default: true) and `reminder_1d` (default: true) toggles
  - Users can disable specific reminder intervals
- If event is cancelled / removed from DB, clean up pending reminders

## Key context

- `events.ticket_url` may be NULL -- fallback to `/events/{event_id}` (event detail page)
- Reminders are the key conversion driver -- every reminder must have a clear ticket CTA
- The 1-day reminder is the highest-converting touchpoint (urgency)
- pg_cron hourly schedule is sufficient (reminders are scheduled to the day, not the minute)
- Existing notification types check constraint on `notifications` table needs to be updated to include `artist_reminder_7d` and `artist_reminder_1d`

## Acceptance
- [ ] `event_reminders` table created with unique (user_id, event_id, reminder_type)
- [ ] Matching pipeline creates 7d and 1d reminders for future events
- [ ] `send-reminders` Edge Function processes due reminders hourly
- [ ] Each reminder notification includes ticket_url (or fallback event link)
- [ ] Email reminders have a large "Tickets sichern" CTA button
- [ ] SMS reminders include a short ticket link
- [ ] In-app reminder notifications show ticket link
- [ ] Users can toggle 7d and 1d reminders independently in preferences
- [ ] Reminders are not created for events < 7 days away (only applicable ones)
- [ ] Duplicate reminders prevented via unique constraint
- [ ] Cancelled/deleted events clean up pending reminders
- [ ] pg_cron job runs hourly to send due reminders

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
