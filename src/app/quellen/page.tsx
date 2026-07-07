import Link from 'next/link';
import type { Metadata } from 'next';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Datenquellen & Lizenzen — LassTreffen.at',
  description:
    'Transparente Übersicht aller Datenquellen, Lizenzen und Attributionen der LassTreffen.at-Plattform.',
};

/* ------------------------------------------------------------------ */
/*  Source category definitions                                        */
/* ------------------------------------------------------------------ */

interface SourceEntry {
  name: string;
  url?: string;
  license?: string;
  licenseUrl?: string;
  description: string;
}

interface SourceCategory {
  title: string;
  icon: string;
  sources: SourceEntry[];
}

const SOURCE_CATEGORIES: SourceCategory[] = [
  {
    title: 'Open Data & offizielle APIs',
    icon: '🏛️',
    sources: [
      {
        name: 'Wien OGD (VADB)',
        url: 'https://www.data.gv.at/',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
        description:
          'Veranstaltungsdatenbank der Stadt Wien — Open Government Data.',
      },
      {
        name: 'TourData / austria.info API',
        url: 'https://www.austria.info/',
        license: 'Offizielle Tourismus-API',
        description:
          'Offizielle Veranstaltungsdaten der Österreich Werbung, bereitgestellt über die TourData-Schnittstelle.',
      },
      {
        name: 'Feratel Deskline API (TOSC5)',
        url: 'https://www.feratel.at/',
        license: 'Tourismus-API',
        description:
          '71 Tourismusregionen aller Bundesländer über das Deskline-System.',
      },
      {
        name: 'OpenStreetMap',
        url: 'https://www.openstreetmap.org/',
        license: 'ODbL 1.0',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        description:
          'Venue- und Standortdaten. © OpenStreetMap-Mitwirkende.',
      },
      {
        name: 'GeoNames',
        url: 'https://www.geonames.org/',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        description:
          'Ortsnamen-Normalisierung und Geocoding für österreichische Gemeinden.',
      },
    ],
  },
  {
    title: 'Landes- & Regionaltourismus',
    icon: '🗺️',
    sources: [
      {
        name: 'burgenland.info',
        url: 'https://www.burgenland.info/',
        description: 'Burgenland Tourismus — Veranstaltungskalender.',
      },
      {
        name: 'burgenland.at',
        url: 'https://www.burgenland.at/',
        description: 'Amt der Burgenländischen Landesregierung — öffentliche Veranstaltungen.',
      },
      {
        name: 'wien.gv.at / wien.info',
        url: 'https://www.wien.gv.at/',
        description: 'Offizielle Event-Informationen der Stadt Wien und Wien Tourismus.',
      },
      {
        name: 'tirol.at',
        url: 'https://www.tirol.at/',
        description: 'Tirol Werbung — Veranstaltungen.',
      },
      {
        name: 'donau.com (Donau NÖ)',
        url: 'https://www.donau.com/',
        description: 'Donau Niederösterreich Tourismus.',
      },
      {
        name: 'kaernten.at',
        url: 'https://www.kaernten.at/',
        description: 'Kärnten Tourismus — Veranstaltungskalender.',
      },
      {
        name: 'graztourismus.at',
        url: 'https://www.graztourismus.at/',
        description: 'Graz Tourismus — Events & Kultur.',
      },
      {
        name: 'bodensee-vorarlberg.com',
        url: 'https://www.bodensee-vorarlberg.com/',
        description: 'Bodensee-Vorarlberg Tourismus.',
      },
      {
        name: 'vorarlberg.travel',
        url: 'https://www.vorarlberg.travel/',
        description: 'Vorarlberg Tourismus.',
      },
      {
        name: 'gastein.com',
        url: 'https://www.gastein.com/',
        description: 'Gasteinertal Tourismus — Events.',
      },
      {
        name: 'linztourismus.at',
        url: 'https://www.linztourismus.at/',
        description: 'Linz Tourismus — Termine & Veranstaltungen.',
      },
    ],
  },
  {
    title: 'Gemeinde-Portale',
    icon: '🏘️',
    sources: [
      {
        name: 'Gem2Go',
        url: 'https://www.gem2go.at/',
        description:
          'Digitale Gemeinde-Plattform — öffentliche Veranstaltungskalender von hunderten österreichischen Gemeinden.',
      },
      {
        name: 'Gemeinde-Websites',
        description:
          'Öffentliche Veranstaltungskalender einzelner Gemeinde-Websites (WordPress-Events, iCal-Feeds, JSON-LD).',
      },
    ],
  },
  {
    title: 'Kultur & Veranstaltungshäuser',
    icon: '🎭',
    sources: [
      {
        name: 'Bundestheater (Burg, Staatsoper, Volksoper)',
        url: 'https://www.bundestheater.at/',
        description: 'Spielpläne der österreichischen Bundestheater.',
      },
      {
        name: 'Wiener Konzerthaus',
        url: 'https://www.konzerthaus.at/',
        description: 'Konzertprogramm.',
      },
      {
        name: 'Musikverein Wien',
        url: 'https://www.musikverein.at/',
        description: 'Konzertprogramm.',
      },
      {
        name: 'Wiener Stadthalle',
        url: 'https://www.stadthalle.com/',
        description: 'Veranstaltungen & Konzerte.',
      },
      {
        name: 'Marx Halle',
        url: 'https://www.marxhalle.at/',
        description: 'Events & Messen in Wien.',
      },
      {
        name: 'Ars Electronica (Linz)',
        url: 'https://ars.electronica.art/',
        description: 'Medienkunst & Technologie-Events.',
      },
      {
        name: 'Posthof (Linz)',
        url: 'https://www.posthof.at/',
        description: 'Konzerte & Veranstaltungen.',
      },
      {
        name: 'ARGEkultur & Rockhouse (Salzburg)',
        url: 'https://www.argekultur.at/',
        description: 'Kulturveranstaltungen Salzburg.',
      },
      {
        name: 'OHO (Oberwart)',
        url: 'https://www.oho.at/',
        description: 'Offenes Haus Oberwart — Kultur im Burgenland.',
      },
    ],
  },
  {
    title: 'Museen',
    icon: '🖼️',
    sources: [
      {
        name: 'KHM, Albertina, MUMOK, Belvedere',
        description: 'Ausstellungen & Veranstaltungen der großen Wiener Museen.',
      },
      {
        name: 'NHM, Technisches Museum, Leopold Museum',
        description: 'Weitere Bundesmuseen — öffentliche Veranstaltungskalender.',
      },
    ],
  },
  {
    title: 'Ticket-Plattformen & Event-Portale',
    icon: '🎫',
    sources: [
      {
        name: 'Wien-Ticket',
        url: 'https://www.wien-ticket.at/',
        description: 'Konzerte, Theater, Sport, Ausstellungen in Wien.',
      },
      {
        name: 'ntry.at',
        url: 'https://ntry.at/',
        description: 'Event-Ticketing-Plattform (Konzerte, Partys).',
      },
      {
        name: 'oeticket.com',
        url: 'https://www.oeticket.com/',
        description: 'Österreichs größter Ticketanbieter.',
      },
      {
        name: 'events.at',
        url: 'https://www.events.at/',
        description: 'Event-Portal für Österreich.',
      },
      {
        name: 'falter.at',
        url: 'https://www.falter.at/',
        description: 'Falter Eventprogramm — Wien & Österreich.',
      },
      {
        name: 'tips.at',
        url: 'https://www.tips.at/',
        description: 'Regionales Event-Portal (OÖ, NÖ, Steiermark).',
      },
    ],
  },
  {
    title: 'Sport & Outdoor',
    icon: '⛰️',
    sources: [
      {
        name: 'bergfex.at',
        url: 'https://www.bergfex.at/',
        description: 'Outdoor- und Sportevents in ganz Österreich.',
      },
      {
        name: 'Alpenverein / Naturfreunde',
        description: 'Wander- und Bergsportveranstaltungen.',
      },
      {
        name: 'laufen.at / Runners Fun / RadNet',
        description: 'Lauf- und Radsport-Events.',
      },
      {
        name: 'ÖFB',
        url: 'https://www.oefb.at/',
        description: 'Österreichischer Fußball-Bund — Spieltermine.',
      },
    ],
  },
  {
    title: 'Community & Soziales',
    icon: '👥',
    sources: [
      {
        name: 'Meetup',
        url: 'https://www.meetup.com/',
        description: 'Community-Events über die Meetup GraphQL API.',
      },
      {
        name: 'Universitäten & Fachhochschulen',
        description:
          '56 Scraper für öffentliche Veranstaltungskalender aller österreichischen Unis, FHs und Pädagogischen Hochschulen.',
      },
    ],
  },
  {
    title: 'Wirtschaft & Messen',
    icon: '💼',
    sources: [
      {
        name: 'Messe Wien / Messe Wels / Messe Graz',
        description: 'Messe- und Kongresstermine.',
      },
      {
        name: 'WKO',
        url: 'https://www.wko.at/',
        description: 'Wirtschaftskammer — Business-Events.',
      },
      {
        name: 'AMS',
        url: 'https://www.ams.at/',
        description: 'Arbeitsmarktservice — Karriere-Events & Jobmessen.',
      },
    ],
  },
  {
    title: 'Kartografie',
    icon: '📍',
    sources: [
      {
        name: 'Mapbox',
        url: 'https://www.mapbox.com/',
        license: 'Mapbox ToS',
        licenseUrl: 'https://www.mapbox.com/legal/tos',
        description:
          'Interaktive Kartenvisualisierung. © Mapbox, © OpenStreetMap.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function QuellenPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm mb-12"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Zurück zur Startseite
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Datenquellen & Lizenzen
        </h1>
        <p className="text-white/50 leading-relaxed mb-12 max-w-2xl">
          LassTreffen.at aggregiert öffentlich zugängliche Veranstaltungsdaten
          aus über 140 Quellen in ganz Österreich. Wir legen Wert auf Transparenz
          und die Einhaltung aller Lizenzbedingungen. Nachfolgend eine Übersicht
          aller genutzten Datenquellen.
        </p>

        {/* Source categories */}
        <div className="space-y-12">
          {SOURCE_CATEGORIES.map((category) => (
            <section key={category.title}>
              <h2 className="text-xl font-semibold text-white mb-5 flex items-center gap-3">
                <span className="text-2xl">{category.icon}</span>
                {category.title}
              </h2>
              <div className="grid gap-3">
                {category.sources.map((source) => (
                  <div
                    key={source.name}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 hover:border-white/10 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-white hover:text-blue-400 transition-colors"
                            >
                              {source.name}
                              <span className="inline-block ml-1 opacity-40">↗</span>
                            </a>
                          ) : (
                            <span className="text-sm font-medium text-white">
                              {source.name}
                            </span>
                          )}
                          {source.license && (
                            source.licenseUrl ? (
                              <a
                                href={source.licenseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                              >
                                {source.license}
                              </a>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                                {source.license}
                              </span>
                            )
                          )}
                        </div>
                        <p className="text-xs text-white/40 mt-1 leading-relaxed">
                          {source.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Legal notice */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Hinweis zur Datennutzung
            </h2>
            <div className="text-sm text-white/50 leading-relaxed space-y-3">
              <p>
                Alle angezeigten Veranstaltungsdaten stammen aus öffentlich
                zugänglichen Quellen. Es werden ausschließlich faktische Informationen
                (Titel, Datum, Ort, Beschreibung) aggregiert — keine urheberrechtlich
                geschützten Volltexte oder Datenbanken.
              </p>
              <p>
                Bei Open-Data-Quellen (gekennzeichnet mit CC BY 4.0 oder ODbL) werden
                die jeweiligen Lizenzbedingungen eingehalten, insbesondere die
                Namensnennung der Datenbereitsteller.
              </p>
              <p>
                Bilder werden — sofern nicht anders angegeben — direkt von den
                jeweiligen Veranstaltern oder aus freien Quellen (Wikimedia Commons,
                Unsplash) bezogen und unterliegen den dort genannten Lizenzvorgaben.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Veranstalter & Datenkorrekturen
            </h2>
            <div className="text-sm text-white/50 leading-relaxed space-y-3">
              <p>
                Sie sind Veranstalter und möchten Ihre Daten korrigieren, ergänzen
                oder entfernen lassen? Kontaktieren Sie uns gerne unter{' '}
                <a
                  href="mailto:dev@glatzdev.com"
                  className="text-white/70 underline underline-offset-2 hover:text-white transition-colors"
                >
                  dev@glatzdev.com
                </a>
                .
              </p>
            </div>
          </section>

          <p className="text-white/30 text-sm pt-4 border-t border-white/[0.06]">
            Zuletzt aktualisiert: April 2026
          </p>
        </div>
      </div>
    </div>
  );
}
