/**
 * Venue new-event alert email template.
 *
 * "Neues bei {venue}: {event}"
 * GDPR-compliant with unsubscribe link in footer.
 */

export interface VenueAlertEmailData {
  venueName: string;
  events: {
    title: string;
    date: string;
    time?: string;
    imageUrl?: string;
    eventPageUrl: string;
    ticketUrl?: string;
  }[];
  venuePageUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export function renderVenueAlertEmail(data: VenueAlertEmailData): string {
  const { venueName, events, venuePageUrl, unsubscribeUrl, preferencesUrl } = data;
  const count = events.length;
  const subject = count === 1
    ? `Neues bei ${venueName}: ${events[0].title}`
    : `${count} neue Events bei ${venueName}`;

  const eventRows = events
    .map(
      (ev) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
        <a href="${escapeHtml(ev.eventPageUrl)}" style="color:#4f46e5;font-weight:600;font-size:15px;text-decoration:none;">${escapeHtml(ev.title)}</a>
        <div style="color:#6b7280;font-size:13px;margin-top:4px;">&#128197; ${escapeHtml(ev.date)}${ev.time ? ` um ${escapeHtml(ev.time)}` : ''}</div>
        ${ev.ticketUrl ? `<a href="${escapeHtml(ev.ticketUrl)}" style="color:#059669;font-size:13px;text-decoration:none;">Tickets &rarr;</a>` : ''}
      </td>
    </tr>`,
    )
    .join('');

  void subject; // subject used by caller, not in HTML body

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neues bei ${escapeHtml(venueName)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px;">
              <h1 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700;">Neues bei ${escapeHtml(venueName)}</h1>
              <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${count} neue${count === 1 ? 's' : ''} Event${count !== 1 ? 's' : ''}</p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${eventRows}
              </table>
              <div style="margin-top:20px;text-align:center;">
                <a href="${escapeHtml(venuePageUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Alle Events bei ${escapeHtml(venueName)}</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                <a href="${escapeHtml(preferencesUrl)}" style="color:#6b7280;text-decoration:underline;">Einstellungen</a>
                &nbsp;|&nbsp;
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Abmelden</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
