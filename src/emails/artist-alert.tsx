/**
 * Artist discovery alert email template.
 *
 * "{Artist} tritt in {Location} auf!"
 *
 * Conversion-optimized with prominent ticket CTA.
 * GDPR-compliant with unsubscribe link in footer.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.8
 */

import type { ArtistAlertEmailData } from '@/lib/email';

/**
 * Render the discovery email as an HTML string.
 * Uses inline styles for maximum email client compatibility.
 */
export function renderArtistAlertEmail(data: ArtistAlertEmailData): string {
  const {
    artistName,
    artistImageUrl,
    eventTitle,
    eventDate,
    eventTime,
    venueName,
    location,
    ticketUrl,
    eventPageUrl,
    unsubscribeUrl,
    preferencesUrl,
  } = data;

  const primaryCtaUrl = ticketUrl ?? eventPageUrl;
  const primaryCtaText = ticketUrl ? 'Tickets sichern' : 'Event-Details ansehen';

  const heroImage = artistImageUrl
    ? `<img src="${escapeHtml(artistImageUrl)}" alt="${escapeHtml(artistName)}" width="600" height="300" style="width:100%;max-width:600px;height:auto;border-radius:12px 12px 0 0;display:block;object-fit:cover;" />`
    : `<div style="width:100%;height:200px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:48px;color:#fff;font-weight:700;">${escapeHtml(artistName.charAt(0))}</span>
      </div>`;

  const timeRow = eventTime
    ? `<tr>
        <td style="padding:4px 0;color:#6b7280;font-size:14px;width:24px;vertical-align:top;">&#128336;</td>
        <td style="padding:4px 0 4px 8px;color:#374151;font-size:14px;">${escapeHtml(eventTime)} Uhr</td>
      </tr>`
    : '';

  const venueRow = venueName
    ? `<tr>
        <td style="padding:4px 0;color:#6b7280;font-size:14px;width:24px;vertical-align:top;">&#127963;</td>
        <td style="padding:4px 0 4px 8px;color:#374151;font-size:14px;">${escapeHtml(venueName)}</td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(artistName)} tritt in ${escapeHtml(location)} auf!</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Hero -->
          <tr>
            <td>
              ${heroImage}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:24px 32px;">
              <!-- Title -->
              <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                ${escapeHtml(artistName)} tritt in ${escapeHtml(location)} auf!
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.5;">
                Ein Artist, dem du folgst, hat ein Event in deiner Naehe.
              </p>

              <!-- Event title -->
              <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#1f2937;">
                ${escapeHtml(eventTitle)}
              </p>

              <!-- Event details -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:14px;width:24px;vertical-align:top;">&#128197;</td>
                  <td style="padding:4px 0 4px 8px;color:#374151;font-size:14px;">${escapeHtml(eventDate)}</td>
                </tr>
                ${timeRow}
                ${venueRow}
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:14px;width:24px;vertical-align:top;">&#128205;</td>
                  <td style="padding:4px 0 4px 8px;color:#374151;font-size:14px;">${escapeHtml(location)}</td>
                </tr>
              </table>

              <!-- Primary CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(primaryCtaUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#6366f1;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;line-height:1;">
                      ${primaryCtaText}
                    </a>
                  </td>
                </tr>
              </table>

              ${ticketUrl ? `
              <!-- Secondary link -->
              <p style="margin:16px 0 0;text-align:center;">
                <a href="${escapeHtml(eventPageUrl)}" target="_blank" style="color:#6366f1;font-size:14px;text-decoration:underline;">
                  Event-Details ansehen
                </a>
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
                Du erhaeltst diese E-Mail, weil du ${escapeHtml(artistName)} auf
                <a href="https://osterreich.events" style="color:#6366f1;text-decoration:none;">osterreich.events</a> folgst.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">E-Mail-Benachrichtigungen abbestellen</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(preferencesUrl)}" style="color:#9ca3af;text-decoration:underline;">Benachrichtigungen verwalten</a>
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
