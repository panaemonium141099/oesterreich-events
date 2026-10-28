import type { FestivalPost } from '../types';

// Existenz, Termine und Programm geprüft am 2026-10-27 gegen stiftmelk.at (Startseite mit
// Veranstaltungen), wachaukulturmelk.at (Festivalreihen in Melk), noe.gv.at
// (Landeskorrespondenz zu den Internationalen Barocktagen 2026 und Presseinformation vom
// 28.05.2026 zu den Sommerspielen Melk). Ein "Lichterfest Melk" ist bei keiner dieser Quellen
// und in keiner Websuche zu finden. Vorher erfunden: das ganze Fest samt Termin 18./19.07.2026,
// Gründungsjahr 1990, Lichtinstallationen, Lasershow, "Chor des Stifts Melk", Eintrittspreis.
// Post neu geschrieben: sagt jetzt, dass es das Fest nicht gibt, und nennt belegte Sommerkultur.
export const post: FestivalPost = {
  slug: 'lichterfest-melk',
  title: 'Lichterfest Melk: kein belegtes Fest',
  subtitle: 'Was es in Melk im Sommer wirklich gibt: Barocktage, Sommerspiele und Konzerte im Stift',
  heroImage: '/images/blog/lichterfest-melk/hero.jpg',
  thumbnailImage: '/images/blog/lichterfest-melk/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.stiftmelk.at',
      'https://www.wachaukulturmelk.at',
      'https://www.noe.gv.at/noe/35._Auflage_der_Internationalen_Barocktage_Stift_Melk.html',
    ],
  },
  readingTime: 3,
  excerpt:
    'Ein „Lichterfest Melk“ lässt sich in keiner offiziellen Quelle finden, weder beim Stift Melk noch bei Wachau Kultur Melk. Belegt sind dagegen die Internationalen Barocktage zu Pfingsten und die Sommerspiele Melk von Juni bis August.',
  category: 'Kultur & Bühne',
  categoryColor: 'bg-yellow-600 text-white',
  keyFacts: {
    dates: 'Kein Termin: ein Lichterfest Melk ist nicht belegt',
    location: 'Stift Melk, Melk (Niederösterreich)',
    address: 'Abt-Berthold-Dietmayr-Str. 1, 3390 Melk',
    genre: 'Kultur im Stift Melk (Barocktage, Konzerte, Advent)',
    price: 'je nach Veranstaltung',
    website: 'https://www.stiftmelk.at',
  },
  lineup: [],
  intro:
    'Unter dem Namen „Lichterfest Melk“ kursiert im Netz die Beschreibung eines sommerlichen Lichterfests am Stift Melk. Wir haben das im Oktober 2026 geprüft: Weder das Stift Melk noch Wachau Kultur Melk, der Veranstalter der großen Festivals in der Stadt, noch die Pressestelle des Landes Niederösterreich kennen ein solches Fest. Diese Seite nannte früher einen Termin im Juli, ein Gründungsjahr und ein Programm mit Lichtinstallationen. Dafür gibt es keinen Beleg, deshalb haben wir diese Angaben entfernt.',
  historyTitle: 'Was es in Melk tatsächlich gibt',
  history:
    'Das Benediktinerstift Melk über der Donau gehört zum UNESCO-Welterbe Wachau. Wachau Kultur Melk veranstaltet in der Stadt die Internationalen Barocktage Stift Melk zu Pfingsten und die Sommerspiele Melk von Juni bis August. 2026 liefen die Barocktage vom 21. bis 25. Mai unter der künstlerischen Leitung von Michael Schade und dem Motto „[er]warten“. Die Sommerspiele Melk spielten 2026 in der Wachauarena „Das Ministerium der Wahrheit“ nach George Orwells „1984“, Premiere war am 17. Juni.',
  whatToExpectTitle: 'Kultur am Stift Melk im Jahreslauf',
  whatToExpect:
    'Wer Musik in der Kulisse des Stifts sucht, findet sie bei den Barocktagen zu Pfingsten, bei Sommerkonzerten im Stift und im Advent. Für Herbst und Winter 2026 kündigt das Stift unter anderem das Adventsingen in der Stiftskirche am 29. November und 20. Dezember sowie „Musik und Wort im Advent“ am 12. Dezember im Kolomanisaal an. Aktuelle Termine stehen auf stiftmelk.at und wachaukulturmelk.at.',
  whatToExpectList: [
    'Internationale Barocktage Stift Melk: jedes Jahr zu Pfingsten',
    'Sommerspiele Melk: Theater in der Wachauarena von Juni bis August',
    'Adventsingen in der Stiftskirche: 29. November und 20. Dezember 2026',
    'Musik und Wort im Advent: 12. Dezember 2026 im Kolomanisaal',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🚂',
      label: 'Anreise mit der Bahn',
      text: 'Direktzüge aus Wien und Linz. Melk liegt an der Westbahnstrecke (ca. 1 Std. ab Wien).',
    },
    {
      icon: '🚗',
      label: 'Parken',
      text: 'Der Besucherparkplatz des Stifts liegt an der Stiftsstraße in Melk.',
    },
    {
      icon: 'ℹ️',
      label: 'Termine',
      text: 'Programm und Karten für Barocktage und Sommerspiele unter wachaukulturmelk.at, Veranstaltungen im Stift unter stiftmelk.at.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturevents in der Wachau entdecken',
  ctaLink: '/map?bundesland=Nieder%C3%B6sterreich&category=Kultur',
  seoTitle: 'Lichterfest Melk: gibt es nicht. Kultur am Stift Melk',
  seoDescription:
    'Ein Lichterfest Melk ist in keiner offiziellen Quelle belegt. Was es wirklich gibt: Internationale Barocktage zu Pfingsten, Sommerspiele Melk und Advent im Stift Melk.',
  keywords: [
    'Lichterfest Melk',
    'Stift Melk Veranstaltungen',
    'Internationale Barocktage Stift Melk',
    'Sommerspiele Melk',
    'Stift Melk Konzert',
    'Wachau Kultur',
    'Niederösterreich Kulturveranstaltung',
  ],
};
