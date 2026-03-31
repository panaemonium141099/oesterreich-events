export interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
}

export interface FestivalKeyFacts {
  dates: string;
  location: string;
  address: string;
  genre: string;
  price: string;
  website: string;
  capacity?: string;
  since?: string;
}

export interface FestivalPost {
  slug: string;
  title: string;
  subtitle: string;
  heroImage: string;
  thumbnailImage: string;
  publishDate: string;
  updatedDate: string;
  readingTime: number;
  excerpt: string;
  category: string;
  categoryColor: string;
  keyFacts: FestivalKeyFacts;
  intro: string;
  historyTitle: string;
  history: string;
  whatToExpectTitle: string;
  whatToExpect: string;
  whatToExpectList: string[];
  practicalInfoTitle: string;
  practicalInfo: { icon: string; label: string; text: string }[];
  gallery: GalleryImage[];
  ctaText: string;
  ctaLink: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  jsonLdEvent: {
    name: string;
    startDate: string;
    endDate: string;
    location: string;
    url: string;
    description: string;
  };
}

export const FESTIVAL_POSTS: FestivalPost[] = [
  {
    slug: 'nova-rock-2026',
    title: 'Nova Rock 2026',
    subtitle: 'Europas härtestes Festival kehrt ins Burgenland zurück',
    heroImage:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&q=85&auto=format&fit=crop',
    thumbnailImage:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80&auto=format&fit=crop',
    publishDate: '2026-03-15',
    updatedDate: '2026-03-31',
    readingTime: 6,
    excerpt:
      'Vom 11. bis 14. Juni 2026 verwandelt sich das Pannonia Fields in Nickelsdorf wieder in das Mekka der Rock- und Metal-Fans. Nova Rock — vier Tage, fünf Bühnen, über 100.000 Besucher.',
    category: 'Musik & Festival',
    categoryColor: 'bg-red-600 text-white',
    keyFacts: {
      dates: '11. – 14. Juni 2026',
      location: 'Pannonia Fields, Nickelsdorf (Burgenland)',
      address: 'Pannonia Fields II, 2425 Nickelsdorf',
      genre: 'Rock, Metal, Alternative, Punk',
      price: 'Tagesticket ab € 89 | 4-Tages-Ticket ab € 229',
      website: 'https://www.novarock.at',
      capacity: '100.000 Besucher',
      since: '2005',
    },
    intro:
      'Mitten in der burgenländischen Tiefebene, nur wenige Kilometer von der ungarischen Grenze entfernt, brennt jedes Jahr im Juni die Erde. Das Nova Rock Festival in Nickelsdorf ist mit über 100.000 Besuchern nicht nur Österreichs größtes Rock-Festival, sondern eines der bedeutendsten in ganz Europa. Heavy Metal, Alternative Rock, Punk und Indie treffen auf ein Ambiente, das seinesgleichen sucht: flaches Festivalgelände, kurze Wege, und eine Stimmung, die bei Einbruch der Nacht durch sämtliche Genres hindurch brennt. Wer das Nova Rock einmal erlebt hat, kommt immer wieder.',
    historyTitle: 'Von 2005 bis heute: Eine Festival-Legende',
    history:
      'Das Nova Rock wurde 2005 ins Leben gerufen und hat sich in zwei Jahrzehnten vom nationalen Geheimtipp zum europäischen Festival-Schwergewicht entwickelt. Headliner wie Metallica, Rammstein, Foo Fighters, Iron Maiden, AC/DC und Linkin Park haben auf den Hauptbühnen gespielt — eine Lineup-Geschichte, die als Who\'s Who des Hard Rock gilt. Das Pannonia Fields wurde bewusst gewählt: Die weitläufige Fläche ohne natürliche Hindernisse erlaubt ein Bühnenkonzept mit fünf simultanen Stages und perfekter Soundausbreitung. Was als Experiment begann, ist heute fester Bestandteil des internationalen Festival-Kalenders.',
    whatToExpectTitle: 'Was erwartet dich 2026?',
    whatToExpect:
      'Das Nova Rock 2026 verspricht vier Tage musikalische Hochspannung mit einem Mix aus internationalen Headlinern und aufstrebenden Acts. Das Festivalgelände bietet neben fünf Bühnen auch ein weitläufiges Campinggelände, zahlreiche Foodstalls aus aller Welt, Merchandise-Bereiche und eine eigene "Festivalstadt" mit Bars, Lounges und Kunstinstallationen.',
    whatToExpectList: [
      '5 Bühnen: Nova Stage, Red Bull Stage, Chill Stage, Acoustic Stage, Club Stage',
      'Über 80 Bands & Artists aus aller Welt',
      'Campingplatz mit Sanitäranlagen und Security 24/7',
      'Internationales Street-Food-Village mit 40+ Anbietern',
      'Nachts: Club-Zelt & Silent Disco bis in den Morgen',
      'Nachhaltigkeit: Pfandbecher-System, eigene Wassertankstellen',
    ],
    practicalInfoTitle: 'Praktische Infos für Festivalbesucher',
    practicalInfo: [
      {
        icon: '🚂',
        label: 'Anreise mit der Bahn',
        text: 'Direktzüge ab Wien Hauptbahnhof nach Nickelsdorf (ca. 45 Min.) — Festivalticket inkl. Shuttle-Bus.',
      },
      {
        icon: '🚗',
        label: 'Anreise mit dem Auto',
        text: 'A4 Abfahrt Nickelsdorf, ausgeschilderter Parkplatz. Fahrgemeinschaften dringend empfohlen.',
      },
      {
        icon: '⛺',
        label: 'Camping',
        text: 'Camping-Tickets separat buchbar. Frühzeitig kaufen — Premium-Spots sind schnell vergriffen.',
      },
      {
        icon: '🌡️',
        label: 'Wetter & Ausrüstung',
        text: 'Juni in der Tiefebene: tagsüber heiß (25–35 °C), nachts kühl. Sonnencreme, Hut und eine Windschutzjacke einpacken.',
      },
      {
        icon: '💳',
        label: 'Cashless-System',
        text: 'Cashless-Armband als Zahlungsmittel. Online aufladen spart Zeit am Einlass.',
      },
    ],
    gallery: [
      {
        src: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80&auto=format&fit=crop',
        alt: 'Nova Rock Festival Bühne mit Lichtshow',
        caption: 'Spektakuläre Lichtshow auf der Hauptbühne',
      },
      {
        src: 'https://images.unsplash.com/photo-1540039155733-5bb30b4f9b6d?w=800&q=80&auto=format&fit=crop',
        alt: 'Begeisterte Menschenmenge beim Nova Rock',
        caption: 'Über 100.000 Fans feiern gemeinsam',
      },
      {
        src: 'https://images.unsplash.com/photo-1501386761578-eaa54b1ea6be?w=800&q=80&auto=format&fit=crop',
        alt: 'Festival Camping Area',
        caption: 'Die Festival-Stadt: Camping unter freiem Himmel',
      },
    ],
    ctaText: 'Rock-Events in Österreich entdecken',
    ctaLink: '/map?category=Musik',
    seoTitle: 'Nova Rock 2026 – Alles was du wissen musst | LassTreffen.at',
    seoDescription:
      'Nova Rock 2026 in Nickelsdorf: Termine, Lineup, Tickets, Camping und Anreise-Tipps. Österreichs größtes Rock-Festival vom 11.–14. Juni 2026.',
    keywords: [
      'Nova Rock 2026',
      'Nova Rock Festival',
      'Nickelsdorf Festival',
      'Rock Festival Österreich',
      'Metal Festival 2026',
      'Pannonia Fields',
    ],
    jsonLdEvent: {
      name: 'Nova Rock Festival 2026',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
      location: 'Pannonia Fields, 2425 Nickelsdorf, Austria',
      url: 'https://www.novarock.at',
      description:
        'Das Nova Rock Festival ist Österreichs größtes Rock- und Metal-Festival mit über 100.000 Besuchern jährlich.',
    },
  },
  {
    slug: 'donauinselfest-2026',
    title: 'Donauinselfest 2026',
    subtitle: 'Das größte kostenlose Open-Air-Festival der Welt kehrt nach Wien zurück',
    heroImage:
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1600&q=85&auto=format&fit=crop',
    thumbnailImage:
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80&auto=format&fit=crop',
    publishDate: '2026-03-20',
    updatedDate: '2026-03-31',
    readingTime: 5,
    excerpt:
      'Vom 26. bis 28. Juni 2026 feiert Wien wieder drei Tage Musik, Tanz und Feste — kostenlos, für alle, mitten auf der Donauinsel. Über 3 Millionen Besucherinnen und Besucher erwartet.',
    category: 'Open-Air & Feste',
    categoryColor: 'bg-blue-600 text-white',
    keyFacts: {
      dates: '26. – 28. Juni 2026',
      location: 'Donauinsel, Wien',
      address: 'Donauinsel, 1220 Wien',
      genre: 'Pop, Rock, Electronic, Volksmusik, Schlager, Hip-Hop',
      price: 'Eintritt frei!',
      website: 'https://www.donauinselfest.at',
      capacity: '3.000.000 Besucher',
      since: '1984',
    },
    intro:
      'Es gibt wenige Dinge, die Wien im Sommer so definieren wie das Donauinselfest. Seit 1984 verwandelt sich die grüne Flusslandschaft zwischen Alter und Neuer Donau jedes Jahr Ende Juni in die größte kostenlose Festivalkulisse der Welt. Mehr als 3 Millionen Menschen kommen an drei Tagen auf die Insel — für Konzerte auf über einem Dutzend Bühnen, kulinarische Vielfalt, Sportangebote und einfach das unbeschreibliche Gemeinschaftsgefühl, das entsteht, wenn eine ganze Stadt zusammen feiert. Kein Ticket nötig. Kein VIP-Bereich. Nur Wien in seiner schönsten Form.',
    historyTitle: 'Seit 1984: Eine Wiener Institution',
    history:
      'Das Donauinselfest wurde 1984 von der Wiener SPÖ als Gegengewicht zum Rummel auf der Donauinsel-Eröffnung ins Leben gerufen und hat sich seither zum kulturellen Herzstück des Wiener Sommers entwickelt. Was mit ein paar tausend Besuchern begann, ist heute im Guinness-Buch der Rekorde als weltgrößtes Freiluftfestival mit Gratiseintritt eingetragen. Die Bühnen heißen FM4, Ö3, Kronenzeitung und spiegeln damit die musikalische Vielfalt wider: Austro-Pop trifft auf internationale Stars, Volksmusik auf Electronic Beats. Namen wie Falco, Christina Aguilera, Die Fantastischen Vier, Die Prinzen und Cro haben die Bühnen bespielt.',
    whatToExpectTitle: 'Was dich 2026 erwartet',
    whatToExpect:
      'Drei Tage, 16 Bühnen, über 500 Acts — das Donauinselfest 2026 bietet ein Programm für jeden Geschmack. Die Insel teilt sich in verschiedene Themenbereiche auf: der Bereich rund um die Hauptbühnen im Norden, der familienfreundliche Süden mit Kinderbereich und Sportzone, und die Partymeile in der Mitte.',
    whatToExpectList: [
      '16+ Bühnen: FM4, Ö3, Krone, und viele Spezial-Stages',
      'Über 500 Auftritte über 3 Tage verteilt',
      'Kostenloser Eintritt für alle Bereiche',
      'Street Food von Wiener Lokalen und internationalen Küchen',
      'Sportzone mit Beach-Volleyball, Skateboarding und mehr',
      'Kinderbereich mit eigenem Programm',
    ],
    practicalInfoTitle: 'So kommst du hin',
    practicalInfo: [
      {
        icon: '🚇',
        label: 'U-Bahn',
        text: 'U1 bis Donauinsel (Haupteingang) oder U6 bis Handelskai. Während des Festivals gibt es Sonderzüge.',
      },
      {
        icon: '🚲',
        label: 'Mit dem Fahrrad',
        text: 'Die Donauinsel ist per Rad optimal erreichbar. Zahlreiche Radabstellplätze am Gelände.',
      },
      {
        icon: '🌧️',
        label: 'Wetter',
        text: 'Ende Juni in Wien: Warm (22–30 °C), aber Gewitter möglich. Leichte Regenjacke mitnehmen.',
      },
      {
        icon: '🍺',
        label: 'Verpflegung',
        text: 'Hunderte Foodstalls auf der ganzen Insel. Eigene Speisen und Getränke dürfen mitgebracht werden!',
      },
      {
        icon: '📍',
        label: 'Orientierung',
        text: 'Die Insel ist 6 km lang — die Donauinselfest-App mit Bühnenplan ist ein Muss.',
      },
    ],
    gallery: [
      {
        src: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80&auto=format&fit=crop',
        alt: 'Riesige Menschenmenge beim Donauinselfest',
        caption: 'Millionen Menschen feiern gemeinsam unter freiem Himmel',
      },
      {
        src: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&q=80&auto=format&fit=crop',
        alt: 'Wien Donau bei Sonnenuntergang',
        caption: 'Die Donauinsel bei Sonnenuntergang — magische Stimmung',
      },
      {
        src: 'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=800&q=80&auto=format&fit=crop',
        alt: 'Konzertbühne beim Donauinselfest',
        caption: 'Weltklasse-Acts auf der Hauptbühne',
      },
    ],
    ctaText: 'Wien-Events entdecken',
    ctaLink: '/map?bundesland=Wien',
    seoTitle: 'Donauinselfest 2026 – Alles Infos zum Gratis-Festival | LassTreffen.at',
    seoDescription:
      'Donauinselfest 2026 Wien: Termine, Programm, Bühnen und Tipps. Das weltgrößte kostenlose Open-Air-Festival vom 26.–28. Juni 2026 auf der Donauinsel.',
    keywords: [
      'Donauinselfest 2026',
      'Donauinselfest Wien',
      'Gratis Festival Wien',
      'Open Air Wien 2026',
      'Donauinsel',
      'kostenlose Konzerte Wien',
    ],
    jsonLdEvent: {
      name: 'Donauinselfest 2026',
      startDate: '2026-06-26',
      endDate: '2026-06-28',
      location: 'Donauinsel, 1220 Wien, Austria',
      url: 'https://www.donauinselfest.at',
      description:
        'Das weltgrößte kostenlose Open-Air-Festival mit über 3 Millionen Besucherinnen und Besuchern auf der Donauinsel in Wien.',
    },
  },
  {
    slug: 'frequency-festival-2026',
    title: 'Frequency Festival 2026',
    subtitle: 'St. Pölten wird im August wieder zur Festivalhauptstadt Österreichs',
    heroImage:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&q=85&auto=format&fit=crop',
    thumbnailImage:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80&auto=format&fit=crop',
    publishDate: '2026-03-25',
    updatedDate: '2026-03-31',
    readingTime: 5,
    excerpt:
      'Das Frequency Festival in St. Pölten ist Österreichs Premium-Event für Alternative, Indie und Electronic. Vom 20. bis 22. August 2026 wieder auf dem Gelände des VAZ.',
    category: 'Musik & Festival',
    categoryColor: 'bg-green-600 text-white',
    keyFacts: {
      dates: '20. – 22. August 2026',
      location: 'VAZ St. Pölten (NÖ)',
      address: 'Kulturbezirk 4, 3100 St. Pölten',
      genre: 'Alternative, Indie Rock, Electronic, Pop',
      price: 'Tagesticket ab € 99 | 3-Tages-Ticket ab € 219',
      website: 'https://www.frequency.at',
      capacity: '70.000 Besucher',
      since: '2001',
    },
    intro:
      'Wenn im August in St. Pölten die Zelte aufgebaut werden, weiss ganz Österreich: Es ist Frequency-Zeit. Das Festival im Kulturbezirk der niederösterreichischen Landeshauptstadt hat seit seiner Gründung 2001 eine Einzigartigkeit entwickelt, die über Genres hinausgeht. Wer beim Frequency war, erinnert sich nicht nur an die Konzerte — er erinnert sich an die Nächte, die Freundschaften, das Lagerfeuer, den Morgengrauen-Rave und das Gefühl, dass für drei Tage nichts anderes zählt als die Musik. Das Frequency ist Kult.',
    historyTitle: 'Mehr als 20 Jahre Festivalgeschichte',
    history:
      'Das Frequency startete 2001 als kleines Alternative-Festival mit einigen tausend Besuchern. Durch konsequentes Booking von internationalen Top-Acts — Radiohead, Arctic Monkeys, Muse, The Chemical Brothers, Billie Eilish, Twenty One Pilots — ist es zum Pflichttermin für die Festivalgeneration geworden. Die besondere Stärke: das Lineup vereint Gitarrenrock mit elektronischer Musik und aktuellem Pop auf eine Art, die kaum ein anderes Festival schafft. Das Gelände rund um den VAZ St. Pölten bietet kurze Wege zwischen den vier Bühnen und ein Camping-Erlebnis, das von Stammbesuchern als familiär und sicher beschrieben wird.',
    whatToExpectTitle: 'Das Frequency 2026 im Überblick',
    whatToExpect:
      'Drei Tage vollgepackt mit Musik, Kunst und Festival-Feeling. Das Frequency 2026 bietet vier Hauptbühnen plus Club-Bereich, einen erweiterten Food-Court und das bewährte Camping-Konzept mit eigener Teilnehmergemeinschaft.',
    whatToExpectList: [
      '4 Bühnen + Club-Area für Electronica und Techno',
      'Headliner aus Alternative, Indie und Electronic',
      'Camping direkt neben dem Festivalgelände',
      'Ausgezeichnetes Street-Food-Konzept mit regionalen Anbietern',
      'Kunstinstallationen und Photowalks',
      'Nachhaltigkeit: „Green Frequency" Initiative mit Zero-Waste-Zones',
    ],
    practicalInfoTitle: 'Anreise & Tipps',
    practicalInfo: [
      {
        icon: '🚂',
        label: 'Westbahn & NÖVOG',
        text: 'St. Pölten Hauptbahnhof in 40 Min. von Wien Westbahnhof. Shuttle-Bus zum Gelände inklusive.',
      },
      {
        icon: '🚗',
        label: 'Auto',
        text: 'A1 Westautobahn, Abfahrt St. Pölten. Park & Ride empfohlen — zentrale Parkplätze sind begrenzt.',
      },
      {
        icon: '⛺',
        label: 'Camping',
        text: 'Camping im und rund um das VAZ-Gelände. Früh buchen, Premium-Spots vergriffen rasch.',
      },
      {
        icon: '📅',
        label: 'Wann kaufen',
        text: 'Early-Bird-Tickets im Jänner — oft 30–40 % günstiger als Abendkasse. Jetzt vormerken!',
      },
      {
        icon: '🎒',
        label: 'Packliste',
        text: 'August in NÖ: Sonnencreme, Regenjacke, Komfort-Schuhe und eine gute Powerbank sind Pflicht.',
      },
    ],
    gallery: [
      {
        src: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80&auto=format&fit=crop',
        alt: 'Frequency Festival Bühnenshow',
        caption: 'Lichterspektakel auf der Hauptbühne',
      },
      {
        src: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&q=80&auto=format&fit=crop',
        alt: 'Festival-Crowd beim Frequency',
        caption: 'Ausgelassene Stimmung vor der Stage',
      },
      {
        src: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80&auto=format&fit=crop',
        alt: 'Camping beim Frequency Festival',
        caption: 'Das Camping-Areal — Zuhause für drei Tage',
      },
    ],
    ctaText: 'Musik-Events in Österreich entdecken',
    ctaLink: '/map?category=Musik&bundesland=Nieder%C3%B6sterreich',
    seoTitle: 'Frequency Festival 2026 – Tickets, Lineup & Tipps | LassTreffen.at',
    seoDescription:
      'Frequency Festival 2026 in St. Pölten: Datum, Lineup, Tickets und Camping-Tipps. Österreichs bestes Alternative- und Indie-Festival vom 20.–22. August 2026.',
    keywords: [
      'Frequency Festival 2026',
      'Frequency St. Pölten',
      'Festival Niederösterreich',
      'Alternative Festival Österreich',
      'Indie Festival 2026',
      'VAZ St. Pölten',
    ],
    jsonLdEvent: {
      name: 'Frequency Festival 2026',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      location: 'VAZ St. Pölten, Kulturbezirk 4, 3100 St. Pölten, Austria',
      url: 'https://www.frequency.at',
      description:
        'Das Frequency Festival in St. Pölten ist Österreichs führendes Alternative- und Indie-Festival mit über 70.000 Besuchern.',
    },
  },
];

export function getFestivalBySlug(slug: string): FestivalPost | undefined {
  return FESTIVAL_POSTS.find(f => f.slug === slug);
}

export function getAllFestivalSlugs(): string[] {
  return FESTIVAL_POSTS.map(f => f.slug);
}
