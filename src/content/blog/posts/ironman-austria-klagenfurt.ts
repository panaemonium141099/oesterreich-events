import type { FestivalPost } from '../types';

// Termin, Teilnehmerzahl, Startzeit und Strecke geprüft am 2026-10-27 gegen
// meinbezirk.at (Liveticker zum 27. IRONMAN Kärnten-Klagenfurt am 14. Juni 2026) und
// de.wikipedia.org/wiki/Ironman_Austria (Geschichte, Streckenführung). ironman.com
// selbst ist für unsere Werkzeuge gesperrt; die alte URL /im-austria leitet auf
// /races/im-austria um. Vorher falsch: Termin 5. Juli 2026 (tatsächlich 14. Juni),
// Starts 7:00/7:05 Uhr (tatsächlich 6:30 Uhr, Agegrouper zehn Minuten nach den
// Profis), "seit 1998" (1998 lief der Vorläufer TriMania, erster IRONMAN Austria
// 1999), Radstrecke über den Weißensee, Ziel in der Innenstadt (Ziel am Metnitzstrand),
// Startgebühr "ca. 600 Euro" und "100.000 Zuschauer" ohne Beleg. Der Termin 2027
// (13. Juni laut Laufkalendern) ist auf ironman.com noch nicht von uns bestätigt.
export const post: FestivalPost = {
  slug: 'ironman-austria-klagenfurt',
  title: 'IRONMAN Austria Klagenfurt',
  subtitle: 'Einer der schönsten Triathlons der Welt: 3,8 km Schwimmen, 180 km Radfahren, 42,2 km Laufen',
  heroImage: '/images/blog/ironman-austria-klagenfurt/hero.jpg',
  thumbnailImage: '/images/blog/ironman-austria-klagenfurt/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.meinbezirk.at/klagenfurt/c-sport/laufende-informationen-zum-ironman-austria-2026_a8681292',
      'https://de.wikipedia.org/wiki/Ironman_Austria',
    ],
  },
  readingTime: 7,
  excerpt:
    'Der IRONMAN Austria in Klagenfurt zählt zu den beliebtesten Langdistanz-Triathlons der Welt. Der Startschuss fällt im Wörthersee beim Strandbad Klagenfurt, die Laufstrecke führt bis in die Klagenfurter Innenstadt.',
  category: 'Sport & Outdoor',
  categoryColor: 'bg-blue-700 text-white',
  keyFacts: {
    dates: '14. Juni 2026 (Termin 2027 folgt)',
    location: 'Strandbad Klagenfurt, Wörthersee und Kärnten',
    address: 'Strandbad Klagenfurt, Metnitzstrand, 9020 Klagenfurt',
    genre: 'Triathlon, Ausdauersport, Langdistanz',
    price: 'Startplätze über ironman.com; Zuschauen kostenlos',
    website: 'https://www.ironman.com/races/im-austria',
    capacity: 'mehr als 3.000 Athletinnen und Athleten aus über 70 Nationen (2026)',
    since: '1999',
  },
  lineup: [],
  lineupTitle: 'Programm-Highlights',
  intro:
    'Der IRONMAN Austria, offiziell IRONMAN Kärnten-Klagenfurt, Austria, startet im Wörthersee beim Strandbad Klagenfurt. Nach 3,8 Kilometern Schwimmen folgen 180 Kilometer auf dem Rad durch Kärnten und ein Marathon entlang des Wörthersees bis in die Klagenfurter Innenstadt, begleitet von Tausenden Zuschauerinnen und Zuschauern. Am 14. Juni 2026 gingen bei der 27. Austragung mehr als 3.000 Athletinnen und Athleten aus über 70 Nationen an den Start.',
  historyTitle: 'Klagenfurt und IRONMAN: Eine Liebesgeschichte seit 1999',
  history:
    'Schon 1998 lief in Klagenfurt mit der TriMania ein Langdistanz-Triathlon mit 124 Startern. Kurz danach erhielt der Veranstalter die IRONMAN-Lizenz, 1999 fand der erste IRONMAN Austria statt, damals mit 802 Startern. Das Feld wuchs rasch auf über 2.000 Anmeldungen Mitte der 2000er-Jahre. 2020 fiel das Rennen wegen Corona aus, 2021 wurde es im September nachgeholt. Heute gilt der IRONMAN Austria als einer der stimmungsvollsten Triathlons weltweit.',
  whatToExpectTitle: 'Was Athleten und Zuschauer erwartet',
  whatToExpect:
    'Der IRONMAN Austria ist nicht nur ein Wettkampf für Athletinnen und Athleten, er ist ein Volksfest. Das Schwimmen führt durch den Wörthersee und auf den letzten Metern durch den Lendkanal. Die Laufstrecke führt traditionell am Nordufer des Wörthersees zwischen Krumpendorf und der Klagenfurter Innenstadt hin und her, das Ziel liegt am Metnitzstrand beim Strandbad. 2026 fiel der Startschuss um 6:30 Uhr, zuerst für die Profis, zehn Minuten später für die Agegrouper.',
  whatToExpectList: [
    'Schwimmstart im Wörthersee beim Strandbad Klagenfurt',
    'Schwimmausstieg nach der Passage durch den Lendkanal',
    'Radstrecke über 180 Kilometer durch Kärnten',
    'Marathon am Nordufer des Wörthersees und durch Klagenfurt',
    'Zieleinlauf am Metnitzstrand mit bewegenden Finisher-Momenten',
    'Zuschauen an der ganzen Strecke kostenlos',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🏅',
      label: 'Anmeldung',
      text: 'Athletinnen und Athleten melden sich auf ironman.com an. Die Startplätze sind begrenzt.',
    },
    {
      icon: '👀',
      label: 'Zuschauen',
      text: 'Das Zuschauen ist kostenlos. Beliebte Spots sind der Schwimmstart am Strandbad, der Lendkanal und die Laufstrecke zwischen Krumpendorf und der Innenstadt.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Öffentliche Anreise nach Klagenfurt empfohlen. Infos zu Verkehr und Sperren am Renntag veröffentlicht der Veranstalter auf ironman.com.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Hotels in Klagenfurt und am Wörthersee für das IRONMAN-Wochenende rechtzeitig buchen.',
    },
  ],
  gallery: [],
  ctaText: 'Sport-Events in Kärnten entdecken',
  ctaLink: '/map?bundesland=Kärnten&category=Sport',
  seoTitle: 'IRONMAN Austria Klagenfurt: Termin, Strecke und Infos',
  seoDescription:
    'IRONMAN Austria Klagenfurt: Langdistanz-Triathlon mit Start im Wörthersee. 2026 am 14. Juni mit über 3.000 Startern. Infos für Athleten und Zuschauer.',
  keywords: [
    'IRONMAN Austria 2026',
    'Triathlon Klagenfurt',
    'IRONMAN Klagenfurt',
    'Langdistanz Triathlon Österreich',
    'Wörthersee Triathlon',
    'IRONMAN Austria Anmeldung',
    'Triathlon Kärnten',
    'Klagenfurt Sport Event',
    'IRONMAN Austria Zuschauer',
    'Ausdauersport Kärnten',
  ],
  jsonLdEvent: {
    name: 'IRONMAN Kärnten-Klagenfurt, Austria 2026',
    startDate: '2026-06-14',
    endDate: '2026-06-14',
    location: 'Strandbad Klagenfurt, Metnitzstrand, 9020 Klagenfurt am Wörthersee, Austria',
    addressCountry: 'AT',
    url: 'https://www.ironman.com/races/im-austria',
    description:
      'Der IRONMAN Austria Klagenfurt ist ein Langdistanz-Triathlon mit Schwimmstart im Wörthersee beim Strandbad Klagenfurt, 180 Kilometern Radstrecke und Marathon.',
    image:
      'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&q=85&auto=format&fit=crop',
  },
};
