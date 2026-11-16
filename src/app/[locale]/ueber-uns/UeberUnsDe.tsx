/**
 * „Über uns“ von lasstreffen.de (fn-31.13). Eigene, kürzere Fassung: sie
 * nennt nur, was die deutsche Seite ausspielt (Gemeindekalender, Eventim,
 * Eventfrog), keine österreichischen Quellen und keine Bereiche, die es dort
 * nicht gibt.
 */
import Link from 'next/link';
import { getSite } from '@/lib/site';
import { SITES } from '@/lib/site/sites';

const H2 = 'text-2xl md:text-3xl font-bold text-white mb-4';
const A = 'underline underline-offset-2 text-white/90 hover:text-white';

export function UeberUnsDe() {
  const site = getSite();
  return (
    <main className="min-h-screen bg-black text-white">
      <article className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm mb-12"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Zurück zur Startseite
        </Link>

        <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight tracking-tight">
          Über {site.brand}
        </h1>
        <p className="text-lg md:text-xl text-white/60 leading-relaxed mb-16">
          Veranstaltungen aus ganz Deutschland an einem Ort: vom Dorffest bis zum Konzert,
          auf einer Karte und nach Ort durchsuchbar.
        </p>

        <div className="space-y-12 text-white/70 leading-relaxed text-base md:text-lg">
          <section>
            <h2 className={H2}>Warum es diese Seite gibt</h2>
            <p className="mb-4">
              Ich heiße <span className="text-white">Jonathan Glatz</span> und betreibe seit Anfang 2026
              die österreichische Seite {SITES.AT.brand}. {site.brand} überträgt dieselbe Idee auf
              Deutschland.
            </p>
            <p>
              Der Ausgangspunkt ist derselbe: Für Veranstaltungen gibt es keinen zentralen Ort.
              Was in einer Gemeinde los ist, steht im Kalender der Gemeinde. Konzerte stehen bei den
              Ticketanbietern. {site.brand} führt beides zusammen und zeigt, was heute, am Wochenende
              und in den nächsten Wochen in deiner Nähe stattfindet.
            </p>
          </section>

          <section>
            <h2 className={H2}>Woher die Termine kommen</h2>
            <p className="mb-4">
              Die Termine stammen aus den öffentlichen Veranstaltungskalendern deutscher Städte und
              Gemeinden sowie von den Ticketanbietern Eventim und Eventfrog. Sie werden täglich neu
              gelesen. Jede Event-Seite nennt ihre Quelle und verlinkt auf die Originalseite.
            </p>
            <p>
              Alle Quellen und Lizenzen stehen auf der Seite{' '}
              <Link href="/quellen" className={A}>Datenquellen und Lizenzen</Link>.
            </p>
          </section>

          <section>
            <h2 className={H2}>Wie die Daten geprüft werden</h2>
            <ol className="space-y-2 list-decimal list-inside pl-1">
              <li><span className="text-white">Ort:</span> Jeder Termin wird einer Gemeinde aus dem
                amtlichen Gemeindeverzeichnis zugeordnet. Termine ohne verlässlichen Ort erscheinen nicht.</li>
              <li><span className="text-white">Doppelte Einträge:</span> Derselbe Termin aus mehreren
                Quellen wird zu einem Eintrag zusammengeführt.</li>
              <li><span className="text-white">Kategorie:</span> Ein regelbasierter Klassifikator ordnet
                jeden Termin ein. Texte werden nicht von einer KI umgeschrieben oder ergänzt.</li>
              <li><span className="text-white">Aktualität:</span> Listet eine Quelle einen Termin nicht
                mehr, wird er zurückgezogen.</li>
            </ol>
          </section>

          <section>
            <h2 className={H2}>Wie sich die Seite finanziert</h2>
            <p>
              Die Seite ist kostenlos. Ticket-Links zu Eventim enthalten unsere Partner-Kennung:
              Kaufst du darüber ein Ticket, erhält {site.brand} eine Provision von Eventim. Der
              Ticketpreis bleibt für dich gleich. Wir verkaufen keine Tickets selbst.
            </p>
          </section>

          <section>
            <h2 className={H2}>Kontakt</h2>
            <p>
              Fehlt ein Termin, stimmt etwas nicht, oder möchtest du als Veranstalter einen Eintrag
              korrigieren oder entfernen lassen? Schreib an{' '}
              <a href={`mailto:${site.contact.office}`} className={A}>{site.contact.office}</a>.
            </p>
          </section>

          <section className="pt-6 border-t border-white/10">
            <p className="text-sm text-white/40">
              Vollständige rechtliche Angaben findest du im{' '}
              <Link href="/impressum" className="underline underline-offset-2 hover:text-white/70">Impressum</Link>.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
