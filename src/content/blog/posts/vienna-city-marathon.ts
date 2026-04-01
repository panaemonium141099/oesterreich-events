import type { FestivalPost } from '../types';

export const post: FestivalPost = {
  slug: 'vienna-city-marathon',
  title: 'Vienna City Marathon',
  subtitle: 'Einer der schönsten Marathons Europas – durch das Herz der Weltkulturstadt Wien',
  heroImage:
    'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=1600&q=85&auto=format&fit=crop',
  thumbnailImage:
    'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&q=80&auto=format&fit=crop',
  publishDate: '2026-03-31',
  updatedDate: '2026-03-31',
  readingTime: 6,
  excerpt:
    'Der Vienna City Marathon zählt zu den zehn größten Marathons Europas. Rund 40.000 Läufer passieren Schloss Schönbrunn, den Prater und die Ringstraße – flache Strecke, beste Zeiten.',
  category: 'Sport & Outdoor',
  categoryColor: 'bg-blue-600 text-white',
  keyFacts: {
    dates: 'April (Sonntag)',
    location: 'Startbereich U4-Station Heiligenstadt, Ziel: Heldenplatz',
    address: 'Startbereich: Heiligenstadt, 1190 Wien; Ziel: Heldenplatz, 1010 Wien',
    genre: 'Marathon, Halbmarathon, 10km Run, Staffel',
    price: 'Marathon ab ca. € 100 | Halbmarathon ab ca. € 65 | 10km ab ca. € 35',
    website: 'https://www.vienna-marathon.com',
    capacity: 'ca. 40.000 Teilnehmer, 250.000 Zuschauer',
    since: '1984',
  },
  lineup: [
    { name: 'Marathon (42,195 km)', role: 'headliner', stage: 'Gesamtstrecke' },
    { name: 'Halbmarathon (21,098 km)', role: 'headliner', stage: 'Halbstrecke' },
    { name: '10km Lauf (Jedermann)', role: 'support', stage: 'Innere Stadt' },
    { name: 'Teamstaffel (4 x ca. 10 km)', role: 'support', stage: 'Gesamtstrecke' },
    { name: 'Elitefeld (internationale Top-Runner)', role: 'special', stage: 'Vorabrennen' },
  ],
  lineupNote: 'Die Elitefelder für 2026 werden Anfang März bekanntgegeben.',
  intro:
    'Seit 1984 zählt der Vienna City Marathon zu den faszinierendsten Stadtläufen Europas. Rund 40.000 Läufer aus über 120 Nationen starten jeden April in Wien und laufen durch eine einzige Kulisse: Jugendstilbauten, kaiserliche Palais, den grünen Prater und die prachtvolle Ringstraße. Kaum eine andere Stadt bietet eine vergleichbar dichte Abfolge an UNESCO-Welterbe auf 42 Kilometern. Und wer kein Marathon-Wettkämpfer ist, kann trotzdem dabei sein: beim Halbmarathon, dem 10km-Lauf oder als enthusiastische Zuschauerin.',
  historyTitle: 'Vier Jahrzehnte Laufen durch Wien',
  history:
    'Der Vienna City Marathon wurde 1984 gegründet und wuchs schnell zum Massenevent. Die Route entwickelte sich über die Jahrzehnte zur heutigen Streckenführung, die weltweit für ihre flache Charakteristik bekannt ist – mit minimalen Höhenunterschieden ideal für schnelle Zeiten und persönliche Bestleistungen. Mehrfach wurden auf der Wiener Strecke Europameisterschaften und internationale Rekorde gelaufen. Das Event zieht heute Teilnehmer aus über 120 Nationen an.',
  whatToExpectTitle: 'Was erwartet dich beim Vienna City Marathon?',
  whatToExpect:
    'Der Marathon führt durch die schönsten Bezirke Wiens. Die Strecke ist flach und schnell – ideal für persönliche Bestzeiten. Neben dem Hauptrennen gibt es Halbmarathon, 10km-Lauf und Staffelbewerb. Über 250.000 Zuschauer säumen die Strecke und feuern die Läufer an. Am Ziel am Heldenplatz warten Medaillen, Verpflegung und Familienmeetingpoints.',
  whatToExpectList: [
    'Flache, schnelle Strecke durch Wien – ideal für persönliche Bestzeiten',
    'Passagen: Prater, Schloss Schönbrunn, Ringstraße, Naschmarkt',
    'Über 250.000 begeisterte Zuschauer entlang der Route',
    'Ziel am historischen Heldenplatz mit Finisher-Medaille',
    'Läufer aus über 120 Nationen beim internationalen Elitefeld',
    'Event-Village am Heldenplatz mit Ausrüstern, Verpflegung, Laufsport-Messe',
  ],
  practicalInfoTitle: 'Praktische Infos für Läufer und Zuschauer',
  practicalInfo: [
    {
      icon: '📝',
      label: 'Anmeldung',
      text: 'Anmeldung ab September des Vorjahres. Beliebte Distanzen (Halbmarathon, 10km) oft schnell ausgebucht.',
    },
    {
      icon: '🚇',
      label: 'Anreise',
      text: 'Startbereich Heiligenstadt: U4 Endstation. Ziel Heldenplatz: U2/U3 Volkstheater oder U3 Herrengasse.',
    },
    {
      icon: '👟',
      label: 'Vorbereitung',
      text: 'Für Marathon: mindestens 4–6 Monate spezifisches Training. Schuhauswahl und Ernährungsstrategie wichtig.',
    },
    {
      icon: '🏆',
      label: 'Zuschauer-Tipp',
      text: 'Kilometer 30–35 entlang der Ringstraße und der Zieleinlauf am Heldenplatz sind die emotionalsten Stellen.',
    },
  ],
  gallery: [
    {
      src: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&q=80&auto=format&fit=crop',
      alt: 'Läufer beim Marathon in einer Stadtkulisse',
      caption: 'Tausende Läufer durch die Wiener Innenstadt',
    },
    {
      src: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80&auto=format&fit=crop',
      alt: 'Marathon Zieleinlauf mit jubelndem Publikum',
      caption: 'Der emotionale Zieleinlauf am Heldenplatz',
    },
    {
      src: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80&auto=format&fit=crop',
      alt: 'Läufer an einem Verpflegungspunkt beim Marathon',
      caption: 'Wasser und Energie an den Verpflegungspunkten',
    },
  ],
  ctaText: 'Sport-Events in Wien entdecken',
  ctaLink: '/map?category=Sport&region=Wien',
  seoTitle: 'Vienna City Marathon 2026 – Anmeldung, Strecke & Tipps',
  seoDescription:
    'Vienna City Marathon 2026: Anmeldung, Strecke durch Schönbrunn & Ringstraße, Termine und Tipps für Läufer und Zuschauer beim Wien-Marathon im April.',
  keywords: [
    'Vienna City Marathon',
    'Wien Marathon 2026',
    'Vienna Marathon Anmeldung',
    'Marathon Wien April',
    'Halbmarathon Wien',
    '10km Lauf Wien',
    'Laufevent Wien',
    'Wien Marathon Strecke',
    'VCM 2026',
    'Marathon Europas schönster',
  ],
  jsonLdEvent: {
    name: 'Vienna City Marathon 2026',
    startDate: '2026-04-26',
    endDate: '2026-04-26',
    location: 'Heiligenstadt, 1190 Wien, Austria',
    url: 'https://www.vienna-marathon.com',
    description:
      'Der Vienna City Marathon ist einer der größten und schönsten Stadtmarathons Europas mit rund 40.000 Teilnehmern.',
  },
};
