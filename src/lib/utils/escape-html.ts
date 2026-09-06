/**
 * HTML-Escaping für Werte, die in eine E-Mail-Vorlage interpoliert werden.
 *
 * Gebraucht überall dort, wo Fremdeingaben in Benachrichtigungs-Mails
 * landen (Inserate, Leads). Ohne Escaping trägt jede eingereichte
 * Beschreibung ihr eigenes Markup in den Posteingang.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
