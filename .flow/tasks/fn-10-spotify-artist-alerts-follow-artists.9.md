# fn-10-spotify-artist-alerts-follow-artists.9 SMS Notification Service with Twilio Integration

## Description
Integrate Twilio for SMS notifications with conversion-focused messaging. Each SMS includes a short ticket link. Include opt-out handling and phone number validation.

**Size:** M
**Files:** `src/lib/sms.ts`, `src/lib/notification-sender.ts` (update)

## Approach

- Use Twilio REST API via fetch (Deno-compatible, no npm SDK needed)
- Create `src/lib/sms.ts` with `sendArtistAlertSMS()` and `sendArtistReminderSMS()` functions
- SMS formats (conversion-focused, max 160 chars):
  - **Discovery**: "{artist} tritt am {date} in {location} auf! Tickets: {ticket_url_or_short_link}"
  - **7d reminder**: "In 1 Woche: {artist} live in {location}! Tickets: {url}"
  - **1d reminder**: "Morgen: {artist} in {location}! Letzte Chance: {url}"
- Truncate event title if needed to fit 160 chars
- ticket_url fallback: use `https://osterreich.events/events/{id}` when no ticket_url
- Phone number validation: E.164 format, Austrian numbers start with +43
- Wire into `notification-sender.ts`: check `channel_sms=true` and valid `phone_number`
- Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Handle opt-out: STOP keyword response sets `channel_sms=false`
- Error handling: retry up to 2 times, log undeliverable numbers

## Key context

- SMS is the highest-urgency channel -- 1d reminders via SMS have the highest conversion potential
- Twilio SMS costs money per message -- rate limit to prevent cost explosion
- Austrian mobile numbers: +43 6XX XXX XXXX
- Only for users who explicitly opted in AND provided a phone number

## Acceptance
- [ ] SMS messages include ticket link (ticket_url or event page fallback)
- [ ] Discovery and reminder SMS variants with conversion-focused copy
- [ ] SMS fits in 1-2 segments (max ~300 chars)
- [ ] Phone number validated as E.164 format before sending
- [ ] `notification-sender.ts` checks `channel_sms` and `phone_number` before sending
- [ ] Retry logic: 2 attempts on transient failure
- [ ] Twilio env vars documented
- [ ] No SMS sent to users who have not explicitly opted in
- [ ] Works in both Deno and Node.js environments

## Done summary
Implemented Twilio SMS notification service with raw fetch API (no SDK, Deno-compatible). Created src/lib/sms.ts with sendArtistAlertSMS and sendArtistReminderSMS functions, E.164 phone validation, retry logic (2 attempts), and SMS truncation to 300 chars. Wired into notification-sender.ts to check channel_sms + phone_number before sending. Added 17 tests.
## Evidence
- Commits: 2808c9315805a9f2ca3856598d835a06c06144da
- Tests: npx vitest run src/__tests__/lib/sms.test.ts
- PRs: