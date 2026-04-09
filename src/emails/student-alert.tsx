/**
 * Student Thursday/Friday alert email template.
 *
 * "Heute Abend fur Studenten: {count} Events"
 * GDPR-compliant with unsubscribe link.
 */

export interface StudentAlertEmailData {
  cityName: string;
  dayLabel: string; // "Donnerstag" or "Freitag"
  events: {
    title: string;
    time?: string;
    venueName?: string;
    category?: string;
    imageUrl?: string;
    eventPageUrl: string;
  }[];
  studentPageUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export function renderStudentAlertEmail(data: StudentAlertEmailData): string {
  const { cityName, dayLabel, events, studentPageUrl, unsubscribeUrl, preferencesUrl } = data;

  const eventRows = events
    .map(
      (ev) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            ${
              ev.imageUrl
                ? `<td width="64" style="vertical-align:top;padding-right:12px;">
                    <img src="${escapeHtml(ev.imageUrl)}" alt="" width="64" height="64" style="border-radius:8px;object-fit:cover;display:block;" />
                  </td>`
                : ''
            }
            <td style="vertical-align:top;">
              <a href="${escapeHtml(ev.eventPageUrl)}" style="color:#4f46e5;font-weight:600;font-size:15px;text-decoration:none;">${escapeHtml(ev.title)}</a>
              <div style="color:#6b7280;font-size:13px;margin-top:2px;">
                ${ev.time ? `${escapeHtml(ev.time)} Uhr` : 'Heute Abend'}
                ${ev.venueName ? ` &middot; ${escapeHtml(ev.venueName)}` : ''}
              </div>
              ${ev.category ? `<span style="display:inline-block;margin-top:4px;padding:2px 8px;background:#ede9fe;color:#7c3aed;font-size:11px;border-radius:10px;">${escapeHtml(ev.category)}</span>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(dayLabel)} fur Studenten in ${escapeHtml(cityName)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${escapeHtml(dayLabel)} fur Studenten</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${events.length} Events in ${escapeHtml(cityName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${eventRows}
              </table>
              <div style="margin-top:20px;text-align:center;">
                <a href="${escapeHtml(studentPageUrl)}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Alle Studenten-Events</a>
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
