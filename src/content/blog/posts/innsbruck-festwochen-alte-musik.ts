import type { FestivalPost } from '../types';

// Termin, Programm, Leitung, Spielorte, Ermäßigungen und Geschichte geprüft am 2026-10-27 gegen
// altemusik.at (Startseite, /de/die-festwochen/geschichte, /de/ihr-besuch/spielstaetten,
// /de/ihr-besuch/tickets-ermaessigungen, /de/presse, /en/the-festwochen/watch-read-listen/news/
// the-programme-for-the-50th-innsbrucker-festwochen-has-been-published) sowie operawire.com und
// papageno.hu (Opern-Termine, Regie). Vorher falsch: Termin 18.7. bis 29.8.2026 (tatsächlich
// 24.7. bis 30.8.), Gründung durch "Ernst Kubitschek" (Gründer laut Festwochen: Otto Ulf),
// Jacobs-Amtszeit "1992–2013" (nicht belegt), erfundenes Lineup (Cecilia Bartoli, Akademie für
// Alte Musik Berlin, Ensemble Il Pomo d'Oro, "Promenadenkonzerte" im Hofburg-Innenhof),
// Barockoper "in der Hofburg" (Festwochen-Oper spielt im Tiroler Landestheater), Preise
// "ab 30 €/75 €" und "35.000 Besucher" (unbelegt), Rangliste neben Glyndebourne/Göttingen.
export const post: FestivalPost = {
  slug: 'innsbruck-festwochen-alte-musik',
  title: 'Innsbruck Festwochen der Alten Musik',
  subtitle: 'Europas renommiertestes Festival für Barockmusik und Alte Musik in historischer Kulisse',
  heroImage: '/images/blog/innsbruck-festwochen-alte-musik/hero.jpg',
  thumbnailImage: '/images/blog/innsbruck-festwochen-alte-musik/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.altemusik.at/en/the-festwochen/watch-read-listen/news/the-programme-for-the-50th-innsbrucker-festwochen-has-been-published',
      'https://www.altemusik.at/de/ihr-besuch/spielstaetten',
      'https://www.altemusik.at/de/ihr-besuch/tickets-ermaessigungen',
      'https://www.altemusik.at/en/press/press-releases/detail/programme-presentation-01122025',
      'https://www.altemusik.at/de/die-festwochen/geschichte',
      'https://papageno.hu/english/news/2026/03/50th-innsbrucker-festwochen-der-alten-musik-programme/',
      'https://www.altemusik.at/de/ihr-besuch/faq',
    ],
  },
  readingTime: 6,
  excerpt:
    'Die Innsbrucker Festwochen der Alten Musik gelten als eine der wichtigsten Adressen für Barockmusik weltweit. Jährlich im Sommer erklingt Alte Musik in einzigartigen historischen Innsbrucker Spielorten.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-purple-700 text-white',
  keyFacts: {
    dates: '2026: 24. Juli bis 30. August (50. Festwochen). Termin 2027 folgt, Programmvorstellung am 30. November 2026',
    location: 'Tiroler Landestheater, Haus der Musik, Schloss Ambras und weitere Spielorte in Innsbruck',
    address: 'Haus der Musik Innsbruck, Universitätsstraße 1, 6020 Innsbruck',
    genre: 'Oper, Barockkonzert, Alte Musik, Historische Aufführungspraxis',
    price: 'Preise je Veranstaltung; 50 % Ermäßigung unter 30 Jahren, 10 € Ermäßigung unter 18',
    website: 'https://www.altemusik.at',
    since: '1976',
  },
  lineup: [
    { name: 'Ottavio Dantone (Musikalischer Leiter)', role: 'headliner', stage: 'Il pomo d\'oro, 7. bis 16. August' },
    { name: 'Accademia Bizantina (Festivalorchester)', role: 'headliner' },
    { name: 'René Jacobs (Gastdirigent)', role: 'special' },
    { name: 'Alessandro De Marchi (Gastdirigent)', role: 'special' },
    { name: 'Anna Bonitatibus (Mezzosopran)', role: 'support' },
    { name: 'Jean Rondeau', role: 'support' },
    { name: 'Giovanni Antonini', role: 'support' },
  ],
  lineupTitle: 'Programm-Highlights 2026',
  lineupNote:
    'Mitwirkende der 50. Festwochen 2026 laut altemusik.at. Das Programm 2027 wird am 30. November 2026 vorgestellt.',
  intro:
    'Seit 1976 macht Innsbruck im Sommer einen Schritt zurück in die Zeit: Die Festwochen der Alten Musik holen Barockopern, Kantaten und Madrigale aus der Vergangenheit in die Gegenwart, und das in einem der schönsten historischen Stadtbilder Europas. Die Kombination aus historisch informierter Aufführungspraxis und Spielorten wie dem Tiroler Landestheater, Schloss Ambras, der Hofkirche und der Stiftskirche Wilten schafft ein besonderes Klangerlebnis.',
  historyTitle: '50 Jahre Alte Musik in Innsbruck',
  history:
    'Die Innsbrucker Festwochen der Alten Musik wurden 1976 gegründet, Gründer war Otto Ulf (1907 bis 1993). Der Gesangswettbewerb der Festwochen trägt den Namen von Pietro Antonio Cesti, der als Hofmusiker in Innsbruck wirkte. Künstlerische Leiter waren unter anderen Howard Arman, René Jacobs und Alessandro De Marchi; durch den Experten Alan Curtis wurde Innsbruck zu einem Zentrum der szenischen Barockoper. Seit 2023 ist Eva-Maria Sens Künstlerische Direktorin, Ottavio Dantone Musikalischer Leiter. 2026 feierten die Festwochen ihren 50. Sommer mit Cestis Großoper „Il pomo d\'oro“.',
  whatToExpectTitle: 'Was die Festwochen bieten',
  whatToExpect:
    'Herzstück der Festwochen 2026 war Cestis „Il pomo d\'oro“ unter Ottavio Dantone, mit 47 Rollen für 20 Sängerinnen und Sänger, inszeniert von Fabio Ceresa. Dazu kamen Händels „Atalanta“ als Barockoper:Jung mit jungen Stimmen aus dem Cesti-Wettbewerb, Orchesterkonzerte, die Ambraser Schlosskonzerte und ein Fest im Hofgarten bei freiem Eintritt. Den Abschluss bildete am 30. August das Finale des 17. Cesti-Wettbewerbs für Barockgesang.',
  whatToExpectList: [
    'Festwochen-Oper im Tiroler Landestheater',
    'Barockoper:Jung mit Teilnehmenden des Cesti-Wettbewerbs',
    'Orchesterkonzerte mit dem Festivalorchester Accademia Bizantina und Gästen',
    'Ambraser Schlosskonzerte auf Schloss Ambras',
    'Internationaler Cesti-Wettbewerb für Barockgesang, 2026 zum 17. Mal',
    'Fest im Hofgarten mit kostenlosen Angeboten',
  ],
  practicalInfoTitle: 'Praktische Infos zu den Festwochen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Online im Webshop unter altemusik.at (Kundenkonto nötig) oder im Haus der Musik und in der Innsbruck Information. Gekaufte Karten können nicht storniert werden.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Bis Innsbruck Hauptbahnhof. Tiroler Landestheater, Haus der Musik und Hofkirche liegen nebeneinander in der Innenstadt nahe der Hofburg, Schloss Ambras liegt außerhalb des Zentrums.',
    },
    {
      icon: '💶',
      label: 'Ermäßigungen',
      text: '50 % für Menschen unter 30, 10 € weniger unter 18, 40 % mit Behindertenpass, 25 % beim Kauf von fünf Terminen. Mit dem Kulturpass gibt es Karten aus einem begrenzten Kontingent gratis.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Innsbruck bietet gutes Hotelandebot. Für Premierenwochenenden frühzeitig buchen. Ferienwohnungen im Inntal als Alternative.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturevents in Innsbruck entdecken',
  ctaLink: '/map?bundesland=Tirol&category=Kultur',
  seoTitle: 'Innsbruck Festwochen Alte Musik: Programm & Tickets',
  seoDescription:
    'Innsbrucker Festwochen der Alten Musik: Barockoper im Tiroler Landestheater, Konzerte und Cesti-Wettbewerb. Tickets, Ermäßigungen und Tipps zum Alte-Musik-Festival.',
  keywords: [
    'Innsbruck Festwochen Alte Musik 2026',
    'Barockmusik Innsbruck',
    'Alte Musik Festival Tirol',
    'Hofburg Innsbruck Konzert',
    'Innsbrucker Festwochen',
    'Barockoper Innsbruck',
    'Alte Musik Österreich',
    'Innsbruck Sommer Kultur',
    'altemusik.at Programm',
    'Barockkonzert Tirol',
  ],
  jsonLdEvent: {
    name: 'Innsbrucker Festwochen der Alten Musik 2026',
    startDate: '2026-07-24',
    endDate: '2026-08-30',
    location: 'Haus der Musik Innsbruck, Universitätsstraße 1, 6020 Innsbruck, Austria',
    addressCountry: 'AT',
    url: 'https://www.altemusik.at',
    description:
      'Die Innsbrucker Festwochen der Alten Musik sind eines der weltweit renommiertesten Festivals für Barockmusik und historische Aufführungspraxis.',
    image:
      'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1600&q=85&auto=format&fit=crop',
  },
};
