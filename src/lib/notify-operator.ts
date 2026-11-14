/**
 * Benachrichtigung an den Betreiber: alles, was eine Handlung von ihm
 * verlangt (Inserat prüfen, Firmen-Anfrage beantworten, Boost-Kauf,
 * gemeldeter Kommentar).
 *
 * EINE Stelle, weil die Aufrufer das Ergebnis des Versands früher nicht
 * auswerteten: `sendGenericEmail` wirft nicht, sondern liefert
 * `{ success: false }`. Ein gescheiterter Versand stand deshalb in keinem
 * Log, das `catch` der Routen griff nie (2026-11: sechs Inserate, eine Mail).
 *
 * Hier: Versand mit Ausweichweg (Brevo, dann Resend), und jeder Fehlschlag
 * steht mit Anlass und Grund im Log (Präfix `[notify-operator]`). Wirft nie:
 * der Anlass (Inserat, Zahlung) ist beim Aufruf schon gespeichert und darf
 * an der Mail nicht scheitern.
 */

import { sendEmailWithFallback } from '@/lib/email';
import { getSite } from '@/lib/site';

/** `BUSINESS_LEADS_EMAIL`, sonst die Kontaktadresse der Seite (office@). */
export function operatorEmail(): string {
  return process.env.BUSINESS_LEADS_EMAIL || getSite().contact.office;
}

export interface OperatorNotification {
  /** Anlass fürs Log, z. B. `inserat:<id>`. Keine personenbezogenen Daten. */
  context: string;
  subject: string;
  html: string;
}

export async function notifyOperator(n: OperatorNotification): Promise<boolean> {
  try {
    const result = await sendEmailWithFallback(operatorEmail(), n.subject, n.html);
    if (!result.success) {
      console.error(`[notify-operator] NICHT zugestellt (${n.context}): ${result.error}`);
      return false;
    }
    if (result.provider === 'resend') {
      console.warn(`[notify-operator] über Resend zugestellt, Brevo schlug fehl (${n.context})`);
    }
    return true;
  } catch (err) {
    console.error(`[notify-operator] NICHT zugestellt (${n.context}):`, err);
    return false;
  }
}
