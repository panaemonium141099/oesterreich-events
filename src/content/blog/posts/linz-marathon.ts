import type { FestivalPost } from '../types';

// Termine, Bewerbe, Startgeld, Strecke, Teilnehmerzahl und Gründungsjahr geprüft am 2026-10-27
// gegen linzmarathon.at (Startseite, /de/bewerbe/*, /de/events/marathonsamstag,
// /de/athleteninfo/labestationen, /en/news/details/blog.24-oberbank-linz-donau-marathon-2026).
// Vorher falsch: "seit 1986" (laut Veranstalter seit 2002), Start/Ziel Hauptplatz (Start ist die
// voest-Autobahnbrücke), "10 km Stadtlauf" am Samstag (es gibt den Viertelmarathon über 10,5 km
// am Sonntag), Nordic Walking und Pasta-Party ohne Beleg, Team-Marathon "4 × ~10 km" (Etappen
// 10/11/14,3/6,9 km), Preise geschätzt, "IAAF-zertifiziert" (Strecke nach IAAF-Richtlinien
// vermessen). Termin 2026 (12.04.) stimmte. Jetzt auf die Ausgabe 2027 (11.04.) umgestellt.
export const post: FestivalPost = {
  slug: 'linz-marathon',
  title: 'Linz Marathon 2027',
  subtitle: 'Laufen durch Linz: der Oberbank Linz Donau Marathon von der voest-Brücke zum Hauptplatz',
  heroImage: '/images/blog/linz-marathon/hero.jpg',
  thumbnailImage: '/images/blog/linz-marathon/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 6,
  excerpt:
    'Der Oberbank Linz Donau Marathon führt jedes Frühjahr Tausende Läuferinnen und Läufer von der voest-Autobahnbrücke durch Linz bis zum Hauptplatz. 2026 waren 21.401 Aktive am Start, die 25. Ausgabe folgt am 11. April 2027.',
  category: 'Sport & Fitness',
  categoryColor: 'bg-green-700 text-white',
  keyFacts: {
    dates: 'Sonntag, 11. April 2027 (Juniormarathon Samstag, 10. April)',
    location: 'Linz Stadtgebiet, Oberösterreich',
    address: 'Start: voest-Autobahnbrücke, Ziel: Hauptplatz Linz',
    genre: 'Marathon, Halbmarathon, Laufsport',
    price: 'Startgeld 2027 je nach Kontingent: Marathon € 75 bis € 110, Halbmarathon € 55 bis € 84',
    website: 'https://www.linzmarathon.at',
    since: '2002',
    capacity: '21.401 Aktive (2026, ausverkauft)',
  },
  lineup: [
    { name: 'Oberbank Marathon 42,195 km', role: 'headliner', day: 'Sonntag', time: '09:30' },
    { name: 'ORLEN Halbmarathon', role: 'headliner', day: 'Sonntag', time: '09:30' },
    { name: 'Hyundai Staffelmarathon (4er-Team)', role: 'support', day: 'Sonntag', time: '09:30' },
    { name: 'LINZ AG Viertelmarathon 10,5 km', role: 'support', day: 'Sonntag', time: '08:45' },
    { name: 'ÖGK Juniormarathon', role: 'special', day: 'Samstag', stage: 'Neue Eisenbahnbrücke' },
    { name: 'Special Olympics Run', role: 'special', day: 'Samstag', stage: 'Neue Eisenbahnbrücke' },
    { name: 'Generali 5K', role: 'support' },
    { name: 'Ascendor Handbike Halbmarathon', role: 'support' },
    { name: 'Fischer Brot Inline Skating Halbmarathon', role: 'support' },
  ],
  lineupTitle: 'Bewerbe 2027',
  lineupNote:
    'Startzeiten laut linzmarathon.at, Änderungen vorbehalten. Das Startgeld steigt mit jedem Kontingent, günstige Kontingente sind teils schon ausverkauft.',
  intro:
    'Jedes Jahr im April verwandelt sich Linz in eine riesige Laufveranstaltung. Der Oberbank Linz Donau Marathon startet auf der voest-Autobahnbrücke und endet am Hauptplatz der oberösterreichischen Landeshauptstadt. 2026 gingen am 12. April 21.401 Aktive an den Start, die Veranstaltung war ausverkauft. Laut Veranstalter kommen rund 150.000 Zuschauerinnen und Zuschauer an die Strecke, und der Marathon ist damit mehr als ein Wettkampf: Es ist ein Stadtfest, bei dem Laufsport und urbane Lebensfreude zusammenkommen.',
  historyTitle: 'Seit 2002: ein Marathon für die Donaustadt',
  history:
    'Den Linz Marathon gibt es laut Veranstalter seit 2002, am 11. April 2027 steht die 25. Ausgabe an. Organisiert wird er von LIVA Sport, den OÖNachrichten und der Stadt Linz. Die Strecke ist nach IAAF-Richtlinien von einem AIMS-Vermesser vermessen. 2026 war Linz Schauplatz der österreichischen Staatsmeisterschaft im Marathon, gewonnen haben die Kenianer Abdednego Cheruiyot in 2:08:53 Stunden und Jackline Chepngeno in 2:26:01 Stunden.',
  whatToExpectTitle: 'Laufen durch ein lebendiges Linz',
  whatToExpect:
    'Der Linz Marathon bietet Distanzen für jedes Leistungsniveau: Marathon, Halbmarathon, Staffelmarathon für Viererteams, Viertelmarathon über 10,5 km und eine 5-km-Strecke. Am Samstag gehört die Neue Eisenbahnbrücke den Kindern beim Juniormarathon und dem Special Olympics Run. Die Läuferinnen und Läufer des Sonntags starten auf der voest-Autobahnbrücke, das Ziel liegt am Hauptplatz.',
  whatToExpectList: [
    'Strecke nach IAAF-Richtlinien vermessen',
    'Distanzen für alle: Marathon, Halbmarathon, Staffel, Viertelmarathon, 5 km',
    'Begeistertes Publikum entlang der gesamten Strecke',
    'Juniormarathon am Samstag (bis zu 2.000 Kinder)',
    'Labestellen rund alle 5 km',
    'Großes Zielgelände am historischen Hauptplatz Linz',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '📝',
      label: 'Anmeldung',
      text: 'Online unter linzmarathon.at. Das Startgeld steigt in vier Kontingenten, beim Marathon von € 75 bis € 110.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Linz liegt an der Westbahnstrecke mit Direktzügen aus Wien und Salzburg. Parken in der Stadt am Wettkampftag schwierig.',
    },
    {
      icon: '🏃',
      label: 'Ausrüstung & Vorbereitung',
      text: 'Wetter im April schwankt stark: leichte Laufbekleidung und eine Regenjacke als Reserve einpacken.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Linz bietet viele Hotels in Bahnhofsnähe. Für das Marathon-Wochenende frühzeitig buchen.',
    },
  ],
  gallery: [],
  ctaText: 'Laufsport-Events in Österreich entdecken',
  ctaLink: '/map?bundesland=Ober%C3%B6sterreich&category=Sport',
  seoTitle: 'Linz Marathon 2027: Termin, Bewerbe und Startgeld',
  seoDescription:
    'Linz Marathon 2027 am 11. April: Strecke von der voest-Brücke zum Hauptplatz, Bewerbe, Startgeld und Tipps für Marathon, Halbmarathon und Viertelmarathon in Linz.',
  keywords: [
    'Linz Marathon',
    'Linz Marathon 2027',
    'Oberbank Linz Donau Marathon',
    'Stadtmarathon Linz',
    'Marathon Österreich',
    'Laufevent Linz',
    'Halbmarathon Linz',
    'Laufsport Oberösterreich',
    'Marathon April Österreich',
    'Linz Laufveranstaltung',
  ],
  jsonLdEvent: {
    name: 'Oberbank Linz Donau Marathon 2027',
    startDate: '2027-04-11',
    endDate: '2027-04-11',
    location: 'Hauptplatz Linz, 4020 Linz, Austria',
    addressCountry: 'AT',
    url: 'https://www.linzmarathon.at',
    description:
      'Der 25. Oberbank Linz Donau Marathon findet am 11. April 2027 statt. Start ist auf der voest-Autobahnbrücke, Ziel am Hauptplatz Linz.',
    image:
      'https://images.unsplash.com/photo-1530143584546-02191bc84eb5?w=1600&q=85&auto=format&fit=crop',
  },
};
