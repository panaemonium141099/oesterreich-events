import type { FestivalPost } from '../types';

export const post: FestivalPost = {
  slug: 'styriarte-graz',
  title: 'styriarte Graz',
  subtitle: 'Nikolaus Harnoncourts Vermächtnis – Klassikfestival mit Seele in der Grazer Altstadt',
  heroImage:
    'https://images.unsplash.com/photo-1465225314224-587cd83d322b?w=1600&q=85&auto=format&fit=crop',
  thumbnailImage:
    'https://images.unsplash.com/photo-1465225314224-587cd83d322b?w=800&q=80&auto=format&fit=crop',
  publishDate: '2026-04-01',
  updatedDate: '2026-04-01',
  readingTime: 7,
  excerpt:
    'Das styriarte Graz verbindet historische Aufführungspraxis mit dem Geist Nikolaus Harnoncourts. Jeden Sommer im Juni und Juli verwandeln sich die schönsten Spielstätten der Grazer Altstadt in Bühnen für Weltklasse-Klassik.',
  category: 'Musik & Konzerte',
  categoryColor: 'bg-indigo-700 text-white',
  keyFacts: {
    dates: '26. Juni – 26. Juli 2026',
    location: 'Helmut-List-Halle, Stadtpfarrkirche, Schloss Eggenberg',
    address: 'Helmut-List-Halle, Conrad-von-Mure-Gasse 1, 8010 Graz',
    genre: 'Klassik, Barockmusik, Kammermusik, Oper',
    price: 'ab 25 € (Frühbucherrabatt verfügbar)',
    website: 'https://www.styriarte.com',
    capacity: 'ca. 30.000 Besucher pro Saison',
    since: '1985',
  },
  lineup: [
    { name: 'Concentus Musicus Wien', role: 'headliner', stage: 'Helmut-List-Halle' },
    { name: 'Chamber Orchestra of Europe', role: 'headliner', stage: 'Helmut-List-Halle' },
    { name: 'Andrés Orozco-Estrada (Dirigent)', role: 'special', stage: 'Helmut-List-Halle' },
    { name: 'Christoph Prégardien (Tenor)', role: 'special', stage: 'Stadtpfarrkirche' },
    { name: 'Dorothea Röschmann (Sopran)', role: 'special', stage: 'Schloss Eggenberg' },
  ],
  lineupNote:
    'Das vollständige Programm erscheint Anfang März 2026 auf der styriarte-Website. Karten sind erfahrungsgemäß schnell ausverkauft – frühzeitige Buchung empfohlen.',
  intro:
    'Das styriarte Graz ist mehr als ein Klassikfestival: Es ist das lebendige Vermächtnis von Nikolaus Harnoncourt, dem Pionier der historischen Aufführungspraxis. Seit 1985 lädt das Festival Musikerinnen und Musiker aus aller Welt nach Graz ein, um Werke des Barock, der Klassik und Romantik mit Leidenschaft und Authentizität neu zu entdecken. Die Spielstätten – von der modernen Helmut-List-Halle über die barocke Stadtpfarrkirche bis zum Schloss Eggenberg – machen jedes Konzert zu einem Gesamterlebnis, bei dem Raum und Klang eine besondere Einheit bilden.',
  historyTitle: 'Harnoncourts Idee: Musik als Dialog mit der Geschichte',
  history:
    'Nikolaus Harnoncourt gründete das Festival 1985 mit der Vision, Klassik nicht als museales Artefakt, sondern als lebendige Auseinandersetzung mit der Vergangenheit zu begreifen. Zusammen mit seinem Ensemble Concentus Musicus Wien setzte er neue Maßstäbe in der historisch informierten Aufführungspraxis – und verwandelte das Festival in eine internationale Plattform für diesen Ansatz. Auch nach Harnoncourts Tod 2016 setzt das styriarte seinen Geist fort: Intendant Mathis Huber führt das Festival in Harnoncourts Sinne weiter und bringt jedes Jahr herausragende Solistinnen, Solisten und Ensembles nach Graz.',
  whatToExpectTitle: 'Ein Festival für alle Sinne',
  whatToExpect:
    'Das styriarte bietet ein vielseitiges Programm mit Orchesterkonzerten, Kammermusikabenden, Opern und Liederabenden. Neben den großen Abendveranstaltungen gibt es Matineen, Kinderkonzerte und Open-Air-Veranstaltungen, die das Festival für ein breites Publikum öffnen. Besonders beliebt sind die Konzerte in Schloss Eggenberg, die ein einzigartiges Ambiente bieten.',
  whatToExpectList: [
    'Orchesterkonzerte in der modernen Helmut-List-Halle',
    'Barockoper und Kammermusik in historischen Kirchen',
    'Open-Air-Konzerte auf Schloss Eggenberg',
    'Matineen und Familienkonzerte für alle Altersgruppen',
    'Pre-Concert-Talks mit Musikerinnen und Musikern',
    'Exklusiver Festival-Pass für alle Konzerte der Saison',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Tickets unter styriarte.com oder im Festival-Büro. Frühbucherrabatt bis März. Abo-Pakete für mehrere Konzerte erhältlich.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Graz HBF ist 20 Gehminuten von der Helmut-List-Halle. IC und RJ aus Wien (2,5 h) und Klagenfurt (1 h) täglich.',
    },
    {
      icon: '🅿️',
      label: 'Parken',
      text: 'Parkhaus Andreas-Hofer-Platz in 5 Minuten Fußweg. Öffentlicher Verkehr empfohlen: Tram 1, 3, 6 bis Jakominiplatz.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Graz bietet ein breites Hotelangebot. Im Juli frühzeitig buchen – das Festival zieht viele Besucherinnen und Besucher von außerhalb an.',
    },
  ],
  gallery: [
    {
      src: 'https://images.unsplash.com/photo-1465225314224-587cd83d322b?w=800&q=80&auto=format&fit=crop',
      alt: 'Klassisches Konzert in historischer Halle',
      caption: 'Weltklasse-Klassik in der Helmut-List-Halle',
    },
    {
      src: 'https://images.unsplash.com/photo-1519683109079-d5f539e1542f?w=800&q=80&auto=format&fit=crop',
      alt: 'Streichquartett auf einer Bühne',
      caption: 'Kammermusik im Geist von Nikolaus Harnoncourt',
    },
    {
      src: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80&auto=format&fit=crop',
      alt: 'Schloss mit Park bei Nacht',
      caption: 'Konzerte auf Schloss Eggenberg – einzigartiges Ambiente',
    },
  ],
  ctaText: 'Klassik-Events in Graz entdecken',
  ctaLink: '/map?bundesland=Steiermark&category=Kultur',
  seoTitle: 'styriarte Graz 2026 – Tickets, Programm & Tipps',
  seoDescription:
    'styriarte Graz 2026 (19. Juni–19. Juli): Klassikfestival in Graz. Tickets, Spielplan & Tipps für Konzerte in Helmut-List-Halle und Schloss Eggenberg.',
  keywords: [
    'styriarte Graz 2026',
    'styriarte Programm',
    'Klassikfestival Graz',
    'Nikolaus Harnoncourt Festival',
    'Helmut-List-Halle Konzert',
    'Schloss Eggenberg Konzert',
    'Barockmusik Graz',
    'Graz Klassik Sommer',
    'styriarte Tickets',
    'Klassikfestival Steiermark',
  ],
  jsonLdEvent: {
    name: 'styriarte Graz 2026',
    startDate: '2026-06-26',
    endDate: '2026-07-26',
    location: 'Helmut-List-Halle, Conrad-von-Mure-Gasse 1, 8010 Graz, Austria',
    addressCountry: 'AT',
    url: 'https://www.styriarte.com',
    description:
      'Das styriarte Graz ist ein internationales Klassikfestival, das im Geist von Nikolaus Harnoncourt historische Aufführungspraxis mit modernem Musikerleben verbindet.',
    image:
      'https://images.unsplash.com/photo-1465225314224-587cd83d322b?w=1600&q=85&auto=format&fit=crop',
  },
};
