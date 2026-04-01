import type { FestivalPost } from '../types';

export const post: FestivalPost = {
  slug: 'wiener-neujahrskonzert',
  title: 'Wiener Neujahrskonzert',
  subtitle: 'Das meistgesehene Klassikkonzert der Welt – live aus dem Goldenen Saal',
  heroImage:
    'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1600&q=85&auto=format&fit=crop',
  thumbnailImage:
    'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80&auto=format&fit=crop',
  publishDate: '2026-03-31',
  updatedDate: '2026-03-31',
  readingTime: 6,
  excerpt:
    'Am 1. Jänner um 11:15 Uhr beginnt das meistgesehene Konzert der Welt. Die Wiener Philharmoniker spielen im Goldenen Saal des Musikvereins – live in über 90 Länder übertragen.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-amber-600 text-white',
  keyFacts: {
    dates: '1. Jänner',
    location: 'Musikverein Wien, Großer Saal (Goldener Saal)',
    address: 'Musikvereinsplatz 1, 1010 Wien',
    genre: 'Klassik, Wiener Walzer, Polka, Marsch',
    price: 'Tickets: Verlosung (bis Oktober des Vorjahres anmelden)',
    website: 'https://www.wienerphilharmoniker.at/neujahrskonzert',
    capacity: 'ca. 1.800 Zuschauer im Saal',
    since: '1939',
  },
  lineup: [
    { name: 'Wiener Philharmoniker', role: 'headliner', stage: 'Goldener Saal' },
    { name: 'Gastdirigent (jährlich wechselnd)', role: 'headliner', stage: 'Goldener Saal' },
    { name: 'Balletteinlagen des Wiener Staatsopernballetts', role: 'special', stage: 'diverse Kulissen' },
  ],
  lineupNote: 'Der Dirigent des nächsten Neujahrskonzerts wird traditionell im Frühling bekanntgegeben.',
  intro:
    'Jedes Jahr am Neujahrstag um 11:15 Uhr Wiener Zeit beginnt das meistgesehene Konzert der Welt. Im legendären Goldenen Saal des Wiener Musikvereins spielen die Wiener Philharmoniker unter wechselnden Weltdirigenten Walzer von Strauß, Polkas und Märsche – live in über 90 Länder übertragen und von rund 50 Millionen Menschen verfolgt. Das Neujahrskonzert ist Österreichs bedeutendster Kulturbotschafter und ein Fixpunkt im internationalen Musikkalender.',
  historyTitle: 'Über 85 Jahre – eine lebende Tradition',
  history:
    'Das erste Konzert zum Jahreswechsel fand am 31. Dezember 1939 statt, das erste eigentliche Neujahrskonzert am 1. Jänner 1941 unter Dirigent Clemens Krauss. Seither ist das Konzert kaum mehr aus der Welt wegzudenken. Dirigenten wie Herbert von Karajan, Carlos Kleiber, Claudio Abbado, Zubin Mehta, Mariss Jansons und viele andere haben es geprägt. Die Blumenarrangements, die den Saal schmücken und je nach Thema gestaltet werden, sind mittlerweile ein eigener Bestandteil des Konzerts. Die Übertragung wurde über die Jahrzehnte immer aufwendiger – heute begleiten Kamerateams die Musik mit Balletteinlagen aus Schlosses Schönbrunn, dem Prater und anderen Wiener Sehenswürdigkeiten.',
  whatToExpectTitle: 'Was erwartet dich beim Neujahrskonzert?',
  whatToExpect:
    'Das Konzert dauert rund zwei Stunden mit einer kurzen Pause. Das Programm umfasst ausschließlich Werke der Strauß-Familie sowie weiterer Wiener Komponisten. Unveränderlicher Bestandteil sind die zugaben: der Radetzkymarsch (letztes Stück, Publikum klatscht mit) und der Donauwalzer nach der Pause. Die Balletteinlagen werden im Vorfeld in Wiener Kulturstätten aufgezeichnet.',
  whatToExpectList: [
    'Etwa 15–20 Werke aus der Wiener Klassik (Strauß, Lanner, Lehár)',
    'Weltbekannte Zugaben: Donauwalzer und Radetzkymarsch',
    'Balletteinlagen des Wiener Staatsopernballetts',
    'Blumenschmuck nach wechselnden Themen (oft österreichische Bundesländer)',
    'Live-Übertragung in über 90 Länder (ORF, Europakonzert)',
    'Tickets nur per Verlosung erhältlich – Anmeldung bis Oktober',
  ],
  practicalInfoTitle: 'Praktische Infos zum Neujahrskonzert',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets & Verlosung',
      text: 'Tickets sind nur über die offizielle Kartenverlosung erhältlich. Anmeldung bis Ende Oktober beim Musikverein.',
    },
    {
      icon: '📺',
      label: 'Live im TV & Streaming',
      text: 'ORF 2, ZDF, arte und viele internationale Sender übertragen das Konzert live am 1. Jänner ab 11:15 Uhr.',
    },
    {
      icon: '🏰',
      label: 'Vor Ort in Wien',
      text: 'Am Wiener Rathausplatz und an anderen öffentlichen Plätzen wird das Konzert oft auf Leinwänden übertragen.',
    },
    {
      icon: '🚇',
      label: 'Anreise Musikverein',
      text: 'U1/U2/U4 Karlsplatz, dann 5 Minuten zu Fuß zum Musikverein. Straßenbahn D, 1, 2 (Oper/Karlsplatz).',
    },
  ],
  gallery: [
    {
      src: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80&auto=format&fit=crop',
      alt: 'Orchestersaal mit Musikern in feierlicher Atmosphäre',
      caption: 'Die Wiener Philharmoniker im legendären Goldenen Saal',
    },
    {
      src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&auto=format&fit=crop',
      alt: 'Violine Nahaufnahme – Klassikkonzert',
      caption: 'Präzision und Leidenschaft der Wiener Philharmoniker',
    },
    {
      src: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80&auto=format&fit=crop',
      alt: 'Prachtsaal mit Blumendekoration und Publikum',
      caption: 'Der Goldene Saal mit seinem jährlichen Blumenschmuck',
    },
  ],
  ctaText: 'Klassik-Events in Wien entdecken',
  ctaLink: '/map?category=Kultur&region=Wien',
  seoTitle: 'Wiener Neujahrskonzert 2026 – Tickets, Programm & Infos',
  seoDescription:
    'Das Wiener Neujahrskonzert der Philharmoniker am 1. Jänner: Tickets (Verlosung), Programm, Live-TV und alles Wissenswerte zum Konzert des Jahres.',
  keywords: [
    'Wiener Neujahrskonzert',
    'Neujahrskonzert Wien',
    'Wiener Philharmoniker Neujahr',
    'Neujahrskonzert 2026',
    'Musikverein Wien',
    'New Year Concert Vienna',
    'Neujahrskonzert Tickets',
    'Goldener Saal Wien',
    'Strauß Konzert Wien',
    'Neujahrskonzert Übertragung',
  ],
  jsonLdEvent: {
    name: 'Wiener Neujahrskonzert 2026',
    startDate: '2026-01-01T11:15:00',
    endDate: '2026-01-01T13:30:00',
    location: 'Musikvereinsplatz 1, 1010 Wien, Austria',
    url: 'https://www.wienerphilharmoniker.at/neujahrskonzert',
    description:
      'Das Neujahrskonzert der Wiener Philharmoniker im Goldenen Saal des Musikvereins ist das meistgesehene Klassikkonzert der Welt.',
  },
};
