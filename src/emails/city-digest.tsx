/**
 * City weekly digest email template.
 *
 * "{count} neue Events in {city}"
 * Lists top events with image, title, date, venue, and ticket link.
 * GDPR-compliant with unsubscribe link in footer.
 */

export interface CityDigestEmailData {
  cityName: string;
  events: {
    title: string;
    date: string;
    time?: string;
    venueName?: string;
    imageUrl?: string;
    eventPageUrl: string;
    ticketUrl?: string;
  }[];
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export function renderCityDigestEmail(data: CityDigestEmailData): string {
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
                ? `<td width="80" style="vertical-align:top;padding-right:12px;">
                    <img src="${escapeHtml(ev.imageUrl)}" alt="" width="80" height="60" style="border-radius:8px;object-fit:cover;display:block;" />
                  </td>`
                : ''
            }
            <td style="vertical-align:top;">
              <a href="${escapeHtml(ev.eventPageUrl)}" style="color:#4f46e5;font-weight:600;font-size:15px;text-decoration:none;">${escapeHtml(ev.title)}</a>
              <div style="color:#6b7280;font-size:13px;margin-top:4px;">
                &#128197; ${escapeHtml(ev.date)}${ev.time ? ` um ${escapeHtml(ev.time)}` : ''}
              </div>
              ${ev.venueName ? `<div style="color:#9ca3af;font-size:13px;">&#128205; ${escapeHtml(ev.venueName)}</div>` : ''}
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
  <title>${events.length} neue Events in ${escapeHtml(cityName)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${events.length} neue Events in ${escapeHtml(cityName)}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Dein wochentlicher Uberblick</p>
            </td>
          </tr>
          <!-- Events -->
          <tr>
            <td style="padding:16px 24px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${eventRows}
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:8px 24px 24px;text-align:center;">
              <a href="https://lasstreffen.at/stadt/${escapeHtml(cityName.toLowerCase())}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Alle Events ansehen</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                <a href="${escapeHtml(preferencesUrl)}" style="color:#6b7280;text-decoration:underline;">Einstellungen</a>
                &nbsp;|&nbsp;
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Abmelden</a>
              </p>
              <p style="margin:4px 0 0;color:#d1d5db;font-size:11px;">LassTreffen.at — Osterreich Events</p>
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
