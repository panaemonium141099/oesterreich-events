/**
 * Supabase Edge Function: send-reminders
 *
 * Processes due event reminders (7d_before and 1d_before) and sends
 * notifications via in-app, email, and SMS channels based on user preferences.
 *
 * Scheduled via pg_cron every hour: SELECT cron.schedule('send-reminders', '0 * * * *', ...)
 * Can also be invoked manually via HTTP POST.
 *
 * Each reminder includes a prominent ticket purchase CTA for conversion.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.12
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Types ────────────────────────────────────────────────────────────────────

interface DueReminder {
  id: string;
  user_id: string;
  event_id: string;
  artist_name: string | null;
  reminder_type: string; // '7d_before' | '1d_before'
  scheduled_for: string;
}

interface EventInfo {
  id: string;
  title: string;
  start_date: string;
  ticket_url: string | null;
}

interface NotificationPrefs {
  user_id: string;
  artist_alerts_enabled: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_sms: boolean;
  phone_number: string | null;
  reminder_7d: boolean;
  reminder_1d: boolean;
}

interface SendStats {
  due_reminders: number;
  in_app_sent: number;
  email_sent: number;
  sms_sent: number;
  skipped: number;
  errors: number;
  duration_ms: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

// ── Reminder content builders ───────────────────────────────────────────────

function buildReminderTitle(reminderType: string): string {
  switch (reminderType) {
    case "7d_before":
      return "In einer Woche!";
    case "1d_before":
      return "Morgen!";
    default:
      return "Event-Erinnerung";
  }
}

function buildReminderBody(
  reminderType: string,
  artistName: string | null,
  eventTitle: string,
  ticketUrl: string
): string {
  const artist = artistName || "Dein Kuenstler";
  switch (reminderType) {
    case "7d_before":
      return `In einer Woche: ${artist} bei ${eventTitle}! Sichere dir jetzt Tickets: ${ticketUrl}`;
    case "1d_before":
      return `Morgen: ${artist} live! Letzte Chance fuer Tickets: ${ticketUrl}`;
    default:
      return `${artist} bei ${eventTitle} – Tickets: ${ticketUrl}`;
  }
}

function buildEmailHtml(
  reminderType: string,
  artistName: string | null,
  eventTitle: string,
  eventDate: string,
  ticketUrl: string
): string {
  const artist = artistName || "Dein Kuenstler";
  const heading =
    reminderType === "7d_before"
      ? `In einer Woche: ${artist} live!`
      : `Morgen: ${artist} live!`;

  const subtext =
    reminderType === "7d_before"
      ? `${artist} tritt am ${eventDate} bei ${eventTitle} auf. Sichere dir jetzt deine Tickets!`
      : `Letzte Chance! ${artist} spielt morgen bei ${eventTitle}. Hast du schon Tickets?`;

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;">${heading}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 24px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">${subtext}</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="background:#6366f1;border-radius:8px;padding:14px 32px;">
              <a href="${ticketUrl}" style="color:#ffffff;text-decoration:none;font-size:18px;font-weight:600;display:block;">
                Tickets sichern
              </a>
            </td>
          </tr>
        </table>
        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:24px 0 0;">
          Du erhaelst diese E-Mail, weil du ${artist} auf oesterreich-events.at folgst.
          <br><a href="https://oesterreich-events.at/settings" style="color:#6366f1;">Benachrichtigungen verwalten</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSmsBody(
  reminderType: string,
  artistName: string | null,
  eventTitle: string,
  ticketUrl: string
): string {
  const artist = artistName || "Dein Kuenstler";
  switch (reminderType) {
    case "7d_before":
      return `In 1 Woche: ${artist} bei ${eventTitle}! Tickets: ${ticketUrl}`;
    case "1d_before":
      return `MORGEN: ${artist} live! Tickets: ${ticketUrl}`;
    default:
      return `${artist} bei ${eventTitle} – ${ticketUrl}`;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-AT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ── Core pipeline ───────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createClient>;

async function processDueReminders(
  supabase: SupabaseClient
): Promise<SendStats> {
  const startTime = Date.now();
  const stats: SendStats = {
    due_reminders: 0,
    in_app_sent: 0,
    email_sent: 0,
    sms_sent: 0,
    skipped: 0,
    errors: 0,
    duration_ms: 0,
  };

  // Step 1: Fetch due reminders (scheduled_for <= now AND sent = false)
  const now = new Date().toISOString();
  const { data: dueReminders, error: fetchError } = await supabase
    .from("event_reminders")
    .select("id, user_id, event_id, artist_name, reminder_type, scheduled_for")
    .eq("sent", false)
    .lte("scheduled_for", now)
    .in("reminder_type", ["7d_before", "1d_before"])
    .limit(500);

  if (fetchError) {
    console.error("Error fetching due reminders:", fetchError);
    stats.errors++;
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  if (!dueReminders || dueReminders.length === 0) {
    console.log("No due reminders found.");
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  stats.due_reminders = dueReminders.length;
  console.log(`Found ${dueReminders.length} due reminders`);

  // Step 2: Fetch event details for all relevant events
  const eventIds = [...new Set(dueReminders.map((r: DueReminder) => r.event_id))];
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_date, ticket_url")
    .in("id", eventIds);

  if (eventsError) {
    console.error("Error fetching events:", eventsError);
    stats.errors++;
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  const eventMap = new Map<string, EventInfo>();
  for (const e of events || []) {
    eventMap.set(e.id, e);
  }

  // Step 3: Fetch notification preferences for all relevant users
  const userIds = [...new Set(dueReminders.map((r: DueReminder) => r.user_id))];
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .in("user_id", userIds);

  const prefsMap = new Map<string, NotificationPrefs>();
  for (const p of prefs || []) {
    prefsMap.set(p.user_id, p);
  }

  // Step 4: Process each due reminder
  const sentIds: string[] = [];

  for (const reminder of dueReminders as DueReminder[]) {
    const event = eventMap.get(reminder.event_id);
    if (!event) {
      console.warn(`Event ${reminder.event_id} not found for reminder ${reminder.id}, skipping`);
      stats.skipped++;
      // Mark as sent to avoid re-processing orphan reminders
      sentIds.push(reminder.id);
      continue;
    }

    const userPrefs = prefsMap.get(reminder.user_id);

    // Check if user has this reminder type enabled
    if (reminder.reminder_type === "7d_before" && userPrefs && !userPrefs.reminder_7d) {
      stats.skipped++;
      sentIds.push(reminder.id);
      continue;
    }
    if (reminder.reminder_type === "1d_before" && userPrefs && !userPrefs.reminder_1d) {
      stats.skipped++;
      sentIds.push(reminder.id);
      continue;
    }

    // Check if alerts are enabled at all
    if (userPrefs && !userPrefs.artist_alerts_enabled) {
      stats.skipped++;
      sentIds.push(reminder.id);
      continue;
    }

    // Build ticket URL (fallback to event page)
    const ticketUrl = event.ticket_url || `https://oesterreich-events.at/events/${event.id}`;
    const notificationType =
      reminder.reminder_type === "7d_before" ? "artist_reminder_7d" : "artist_reminder_1d";

    // 4a: In-app notification
    const inAppEnabled = userPrefs?.channel_in_app ?? true;
    if (inAppEnabled) {
      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: reminder.user_id,
        type: notificationType,
        title: buildReminderTitle(reminder.reminder_type),
        body: buildReminderBody(
          reminder.reminder_type,
          reminder.artist_name,
          event.title,
          ticketUrl
        ),
        event_id: reminder.event_id,
        action_url: ticketUrl,
        read: false,
      });

      if (notifError) {
        if (notifError.code === "23505") {
          // Duplicate, already sent
        } else {
          console.error(`Error creating in-app notification for reminder ${reminder.id}:`, notifError);
          stats.errors++;
        }
      } else {
        stats.in_app_sent++;
      }
    }

    // 4b: Email notification (stub -- uses Resend when task .8 is complete)
    const emailEnabled = userPrefs?.channel_email ?? false;
    if (emailEnabled) {
      const { data: userData } = await supabase.auth.admin.getUserById(reminder.user_id);
      if (userData?.user?.email) {
        // STUB: Will use Resend API when task .8 is integrated
        const _html = buildEmailHtml(
          reminder.reminder_type,
          reminder.artist_name,
          event.title,
          formatDate(event.start_date),
          ticketUrl
        );
        console.log(
          `[STUB] Would send reminder email to ${userData.user.email}: ${buildReminderTitle(reminder.reminder_type)}`
        );
        stats.email_sent++;
      }
    }

    // 4c: SMS notification (stub -- uses Twilio when task .9 is complete)
    const smsEnabled = userPrefs?.channel_sms ?? false;
    if (smsEnabled && userPrefs?.phone_number) {
      const _smsBody = buildSmsBody(
        reminder.reminder_type,
        reminder.artist_name,
        event.title,
        ticketUrl
      );
      console.log(
        `[STUB] Would send reminder SMS to ${userPrefs.phone_number}: ${_smsBody}`
      );
      stats.sms_sent++;
    }

    sentIds.push(reminder.id);
  }

  // Step 5: Mark all processed reminders as sent
  if (sentIds.length > 0) {
    const sentAt = new Date().toISOString();
    for (let i = 0; i < sentIds.length; i += BATCH_SIZE) {
      const batch = sentIds.slice(i, i + BATCH_SIZE);
      const { error: updateError } = await supabase
        .from("event_reminders")
        .update({ sent: true, sent_at: sentAt })
        .in("id", batch);

      if (updateError) {
        console.error("Error marking reminders as sent:", updateError);
        stats.errors++;
      }
    }
  }

  stats.duration_ms = Date.now() - startTime;
  return stats;
}

// ── HTTP Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log("=== Send Reminders Pipeline ===");
    const stats = await processDueReminders(supabase);

    console.log("=== Pipeline Complete ===");
    console.log(`  Due reminders: ${stats.due_reminders}`);
    console.log(`  In-app sent: ${stats.in_app_sent}`);
    console.log(`  Email sent: ${stats.email_sent}`);
    console.log(`  SMS sent: ${stats.sms_sent}`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Duration: ${stats.duration_ms}ms`);

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Send reminders pipeline failed:", message);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
