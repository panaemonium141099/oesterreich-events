import type { FestivalPost } from '../types';

// Termine 2026 und 2027, Öffnungszeiten, Ort, Aussteller, Eintritt, Veranstalter,
// Programm und Website geprüft am 2026-10-28 gegen festival.genussregionen.at
// (2026: 8. bis 10. Mai; Save the Date 2027: Muttertagswochenende, 7. bis 9. Mai),
// bmluk.gv.at/service/presse/lebensmittel/2026/genussfestival-2026.html (17. Ausgabe,
// über 100 Stände, Öffnungszeiten, Eintritt frei, ARGE Netzwerk Kulinarik mit der Stadt
// Wien, Erlebnisbereiche) und wien.info/en/dine-drink/vienna-genussfestival-delights-363228
// (Stadtpark, Parkring, 1010 Wien). Falsch waren: Website genussfestival.at (TLS-Zertifikat
// gehört zu anderem Host, per HTTP nur Platzhalterseite), „über 200 Aussteller“ (über 100),
// „über 100.000 Besucher“, „seit 2008“ und „Österreichs größtes Kulinarik-Festival“ (nicht
// belegt), Kochshows, Slow-Food-Markt, Weinzelt, Craft-Beer-Festival und
// Kinder-Kochworkshops (in keiner Quelle), Öffnungszeiten, PLZ 1030 und „Programm im
// August“.
export const post: FestivalPost = {
  slug: 'wiener-genussfestival',
  title: 'Wiener Genussfestival',
  subtitle: 'Kulinarik-Festival der AMA GENUSS REGIONEN im Wiener Stadtpark, jedes Jahr am Muttertagswochenende',
  heroImage: '/images/blog/wiener-genussfestival/hero.jpg',
  thumbnailImage: '/images/blog/wiener-genussfestival/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-28',
  factSources: {
    checkedAt: '2026-10-28',
    urls: [
      'https://festival.genussregionen.at',
      'https://www.wien.info/en/dine-drink/vienna-genussfestival-delights-363228',
      'https://www.bmluk.gv.at/service/presse/lebensmittel/2026/genussfestival-2026.html',
    ],
  },
  readingTime: 5,
  excerpt:
    'Am Muttertagswochenende wird der Wiener Stadtpark zum Genussmarkt: Über 100 Betriebe mit dem Gütesiegel AMA GENUSS REGION zeigen Spezialitäten aus ganz Österreich. Nächster Termin: 7. bis 9. Mai 2027.',
  category: 'Essen & Trinken',
  categoryColor: 'bg-orange-600 text-white',
  keyFacts: {
    dates: '7. bis 9. Mai 2027 (Muttertagswochenende); 2026: 8. bis 10. Mai',
    location: 'Wiener Stadtpark',
    address: 'Stadtpark, Parkring, 1010 Wien',
    genre: 'Kulinarik, regionale Spezialitäten, Direktvermarkter, Manufakturen',
    price: 'Eintritt frei (Stand 2026) | Speisen und Getränke vor Ort kaufen',
    website: 'https://festival.genussregionen.at',
    capacity: 'über 100 Aussteller (2026)',
    since: 'jährlich, 2026 die 17. Ausgabe',
  },
  lineup: [],
  lineupTitle: 'Programm-Highlights',
  intro:
    'Einmal im Jahr, am Muttertagswochenende, wird der Wiener Stadtpark zum Genussmarkt. Beim GENUSS-FESTIVAL präsentieren über 100 Betriebe mit dem Gütesiegel AMA GENUSS REGION ihre Produkte: bäuerliche Direktvermarkter, Lebensmittelmanufakturen und Gastronomiebetriebe aus ganz Österreich. Gekostet und eingekauft wird direkt an den Ständen, der Eintritt war 2026 frei.',
  historyTitle: 'Ein Fixpunkt im Stadtpark',
  history:
    'Das GENUSS-FESTIVAL findet jährlich im Wiener Stadtpark statt, 2026 bereits zum 17. Mal. Veranstaltet wird es von der ARGE Netzwerk Kulinarik gemeinsam mit der Stadt Wien, unterstützt von Bund, Ländern und EU. Alle Aussteller sind mit dem Gütesiegel AMA GENUSS REGION ausgezeichnet.',
  whatToExpectTitle: 'Was erwartet dich beim Genussfestival?',
  whatToExpect:
    'Das Festival ist in Erlebnisbereiche gegliedert, 2026 waren das „Wald & Wiese“, „Erde“, „Wasser“ und „Spezialitäten“. Angeboten werden unter anderem Käse, Fleisch- und Fischspezialitäten, Brot, Öle und Feinkost. Dazu kommen Mitmach- und Erlebnisstationen, und die Parkkulisse macht den Besuch zum Frühlingsausflug.',
  whatToExpectList: [
    'Über 100 Aussteller mit dem Gütesiegel AMA GENUSS REGION',
    'Bäuerliche Direktvermarkter, Lebensmittelmanufakturen und Gastronomie',
    'Erlebnisbereiche 2026: Wald & Wiese, Erde, Wasser, Spezialitäten',
    'Käse, Fleisch und Fisch, Brot, Öle und Feinkost zum Kosten und Mitnehmen',
    'Mitmach- und Erlebnisstationen',
    'Eintritt frei (2026)',
  ],
  practicalInfoTitle: 'Praktische Infos zum Genussfestival',
  practicalInfo: [
    {
      icon: '🚇',
      label: 'Anreise',
      text: 'Mit der U4 bis zur Station Stadtpark; das Festival liegt im Park an der Ringstraße (Parkring).',
    },
    {
      icon: '🕐',
      label: 'Öffnungszeiten',
      text: '2026: Freitag 11 bis 21 Uhr, Samstag 10 bis 21 Uhr, Sonntag 10 bis 17 Uhr. Die Zeiten für 2027 folgen auf festival.genussregionen.at.',
    },
    {
      icon: '💶',
      label: 'Kosten vor Ort',
      text: 'Eintritt frei (2026). Speisen und Getränke werden direkt bei den Ausstellern gekauft; Budget für Verkostungen einplanen.',
    },
    {
      icon: '🛍️',
      label: 'Einkauf-Tipp',
      text: 'Wiederverwendbare Tasche mitbringen: Direktvermarkter und Manufakturen verkaufen ihre Produkte auch zum Mitnehmen.',
    },
  ],
  gallery: [],
  ctaText: 'Kulinarik-Events in Wien entdecken',
  ctaLink: '/map?category=Kulinarik&region=Wien',
  seoTitle: 'Wiener Genussfestival 2027: Kulinarik im Stadtpark Wien',
  seoDescription:
    'Wiener Genussfestival 2027 im Stadtpark: 7. bis 9. Mai am Muttertagswochenende, über 100 Aussteller mit dem Gütesiegel AMA GENUSS REGION, Spezialitäten aus ganz Österreich.',
  keywords: [
    'Wiener Genussfestival',
    'Genussfestival Wien',
    'Genuss-Festival Stadtpark',
    'Kulinarik Festival Wien',
    'Wien Food Festival',
    'Stadtpark Wien Kulinarik',
    'Wien Genuss 2027',
    'AMA Genuss Region',
    'Muttertag Wien',
    'Genussfestival 2027',
  ],
  jsonLdEvent: {
    name: 'Wiener Genussfestival 2027',
    startDate: '2027-05-07',
    endDate: '2027-05-09',
    location: 'Stadtpark, Parkring, 1010 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://festival.genussregionen.at',
    description:
      'Das GENUSS-FESTIVAL im Wiener Stadtpark zeigt am Muttertagswochenende Spezialitäten von über 100 Betrieben mit dem Gütesiegel AMA GENUSS REGION.',
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=85&auto=format&fit=crop',
  },
};
