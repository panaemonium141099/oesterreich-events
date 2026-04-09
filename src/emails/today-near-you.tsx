/**
 * "Heute in deiner Nahe" daily alert email template.
 *
 * "Heute in {city}: {count} Events"
 * GDPR-compliant with unsubscribe link.
 */

export interface TodayNearYouEmailData {
  cityName: string;
  events: {
    title: string;
    time?: string;
    venueName?: string;
    imageUrl?: string;
    eventPageUrl: string;
    ticketUrl?: string;
  }[];
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export function renderTodayNearYouEmail(data: TodayNearYouEmailData): string {
  const { cityName, events, unsubscribeUrl, preferencesUrl } = data;

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
                ${ev.time ? `&#128336; ${escapeHtml(ev.time)} Uhr` : 'Heute'}
                ${ev.venueName ? ` &middot; ${escapeHtml(ev.venueName)}` : ''}
              </div>
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
  <title>Heute in ${escapeHtml(cityName)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Heute in ${escapeHtml(cityName)}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:14px;">${events.length} Event${events.length !== 1 ? 's' : ''} fur dich</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${eventRows}
              </table>
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
