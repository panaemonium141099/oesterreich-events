/**
 * Welcome email — sent once after a new user signs up.
 *
 * Tone: warm, founder-style, sets expectations on notification cadence
 * (we send max 1 mail/day, never spam — this is the "trust seed" mail).
 */

export interface WelcomeEmailData {
  /** Display name (first name or username). */
  displayName: string;
  /** Absolute URL to the events map. */
  mapUrl: string;
  /** Absolute URL to notification preferences. */
  preferencesUrl: string;
  /** Optional unsubscribe link. */
  unsubscribeUrl?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderWelcomeEmail(data: WelcomeEmailData): string {
  const { displayName, mapUrl, preferencesUrl, unsubscribeUrl } = data;
  const unsubFooter = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Abmelden</a> &nbsp;·&nbsp; `
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Willkommen bei LassTreffen!</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header strip -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 32px 28px;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.85;margin:0 0 8px;">LassTreffen</div>
              <h1 style="margin:0;font-size:26px;font-weight:700;line-height:1.25;">
                Willkommen, ${escapeHtml(displayName)} &#128075;
              </h1>
              <p style="margin:8px 0 0;font-size:15px;line-height:1.5;opacity:0.95;">
                Schön dass du dabei bist. Hier findest du Veranstaltungen aus ganz Österreich.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                LassTreffen ist Österreichs Plattform um Events zu entdecken, mit Freunden hinzugehen
                und neue Leute zu treffen. Drei Dinge die wir dir besonders empfehlen:
              </p>

              <!-- Feature 1 -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px;">
                <tr>
                  <td style="vertical-align:top;width:40px;padding:6px 12px 0 0;">
                    <div style="width:32px;height:32px;border-radius:8px;background:#fef2f2;color:#dc2626;font-size:18px;text-align:center;line-height:32px;">&#128205;</div>
                  </td>
                  <td style="vertical-align:top;">
                    <div style="font-size:15px;font-weight:600;color:#111827;margin:0 0 2px;">Events auf der Karte erkunden</div>
                    <div style="font-size:14px;color:#6b7280;line-height:1.5;">Über 200.000 Veranstaltungen quer durch Österreich — Festivals, Konzerte, Ausstellungen, Sport, Kultur.</div>
                  </td>
                </tr>
              </table>

              <!-- Feature 2 -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px;">
                <tr>
                  <td style="vertical-align:top;width:40px;padding:6px 12px 0 0;">
                    <div style="width:32px;height:32px;border-radius:8px;background:#eef2ff;color:#4f46e5;font-size:18px;text-align:center;line-height:32px;">&#127908;</div>
                  </td>
                  <td style="vertical-align:top;">
                    <div style="font-size:15px;font-weight:600;color:#111827;margin:0 0 2px;">Künstler folgen</div>
                    <div style="font-size:14px;color:#6b7280;line-height:1.5;">Verbinde Spotify und wir sagen dir Bescheid, sobald deine Lieblingsartists in der Nähe spielen.</div>
                  </td>
                </tr>
              </table>

              <!-- Feature 3 -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
                <tr>
                  <td style="vertical-align:top;width:40px;padding:6px 12px 0 0;">
                    <div style="width:32px;height:32px;border-radius:8px;background:#ecfdf5;color:#059669;font-size:18px;text-align:center;line-height:32px;">&#128101;</div>
                  </td>
                  <td style="vertical-align:top;">
                    <div style="font-size:15px;font-weight:600;color:#111827;margin:0 0 2px;">Mit Freunden hingehen</div>
                    <div style="font-size:14px;color:#6b7280;line-height:1.5;">Lade Freunde zu Events ein, schreib in Gruppenchats, plant gemeinsam.</div>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${escapeHtml(mapUrl)}" style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:10px;">
                      Erste Events entdecken &#8594;
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0 20px;" />

              <!-- Notification policy -->
              <div style="background:#f9fafb;border-radius:10px;padding:16px 18px;margin:0 0 8px;">
                <div style="font-size:14px;font-weight:600;color:#111827;margin:0 0 6px;">&#128276; Wie oft hörst du von uns?</div>
                <div style="font-size:13px;color:#4b5563;line-height:1.6;">
                  Maximal <b>1 E-Mail pro Tag</b>. Wir bündeln Aktivität (Freunde, Empfehlungen, Künstler-News) in einer einzigen Zusammenfassung. <b>Sofortige Mails</b> bekommst du nur bei Wichtigem: direkte Event-Einladungen von Freunden und Erinnerungen an Events kurz davor. Du kannst alles
                  <a href="${escapeHtml(preferencesUrl)}" style="color:#dc2626;text-decoration:underline;">in deinen Einstellungen</a> anpassen.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 28px;border-top:1px solid #f3f4f6;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">
              ${unsubFooter}<a href="${escapeHtml(preferencesUrl)}" style="color:#6b7280;text-decoration:underline;">Einstellungen</a>
              <div style="margin-top:6px;">LassTreffen &middot; Österreichs Event-Plattform &middot; lasstreffen.at</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
