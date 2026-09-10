import type { FestivalPost } from '../types';

// Saison-Seite (fn-24), Frist laut SAISON_KALENDER: liveBy 10-01.
// Feiertags- und Ferientermine stammen aus den geprüften `facts` des
// Kalenders (Primärquellen BMB-Ferientermine und RIS), verifiziert am
// 2026-09-10. Bewusst KEINE Liste von Museen mit freiem Eintritt: die
// wechselt jährlich und war zum Redaktionsschluss nicht bestätigt.
export const post: FestivalPost = {
  slug: 'nationalfeiertag-oesterreich',
  title: 'Nationalfeiertag 2026: Montag, 26. Oktober',
  subtitle: 'Was offen ist, was zu hat und was in der Ferienwoche danach läuft',
  heroImage: '/images/blog/nationalfeiertag-oesterreich/hero.jpg',
  heroImageCredit: 'Foto: Gerd Eichmann, CC BY-SA 4.0, Wikimedia Commons',
  publishDate: '2026-09-10',
  updatedDate: '2026-09-10',
  readingTime: 6,
  excerpt:
    'Der Nationalfeiertag 2026 fällt auf einen Montag und startet zehn schulfreie Tage. Was geöffnet hat, wie die Öffis fahren, warum nicht alle Museen gratis sind und was in den Herbstferien läuft.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-red-700 text-white',
  keyFacts: {
    dates: 'Montag, 26. Oktober 2026, Herbstferien 27. bis 31. Oktober',
    location: 'Ganz Österreich',
    address: 'Zentrale Veranstaltungen traditionell am Heldenplatz in Wien',
    genre: 'Feiertag, Tag der offenen Tür, Familienausflüge',
    price: 'Viele Programmpunkte kostenlos',
    website: 'https://www.bmb.gv.at/Themen/schule/schulpraxis/termine/ferientermine_26_27.html',
    since: '1965',
  },
  lineup: [
    { name: 'Nationalfeiertag, Montag 26. Oktober', role: 'headliner' },
    { name: 'Herbstferien, Dienstag 27. bis Samstag 31. Oktober', role: 'headliner' },
    { name: 'Halloween, Samstag 31. Oktober', role: 'special' },
    { name: 'Allerheiligen, Sonntag 1. November', role: 'special' },
    { name: 'Allerseelen, Montag 2. November', role: 'support' },
  ],
  lineupTitle: 'Die zehn freien Tage im Überblick',
  lineupNote:
    'Das Detailprogramm zum Nationalfeiertag, also Leistungsschau, Angelobung und die Tage der offenen Tür in Parlament und Ministerien, wird erfahrungsgemäß erst Anfang bis Mitte Oktober veröffentlicht.',
  intro:
    'Beim Nationalfeiertag ist 2026 alles günstig gelegen: Der 26. Oktober fällt auf einen Montag. Daraus wird ein langes Wochenende, und für Familien sogar deutlich mehr, denn direkt danach beginnen die Herbstferien. Wer vier Urlaubstage nimmt, hat neun Tage am Stück frei.',
  historyTitle: 'Warum überhaupt der 26. Oktober',
  history:
    'Am 26. Oktober 1955 beschloss der Nationalrat das Bundesverfassungsgesetz über die immerwährende Neutralität Österreichs, einen Tag nachdem der letzte alliierte Soldat das Land verlassen hatte. Zum Nationalfeiertag wurde das Datum aber erst zehn Jahre später erklärt, mit dem Bundesgesetz vom 25. Oktober 1965. Und arbeitsfrei war der Tag anfangs nicht: Bis 1967 war er lediglich schulfrei. Erst ein Bundesgesetz vom 28. Juni 1967 machte den 26. Oktober zum arbeitsfreien Feiertag.',
  whatToExpectTitle: 'Was am 26. Oktober offen ist',
  whatToExpect:
    'Der häufigste Stolperstein sind die Öffis: Sie fahren nach Sonn- und Feiertagsfahrplan. Plane den Rückweg entsprechend, gerade wenn du einen Ausflug aufs Land machst. Und ein hartnäckiger Irrtum gehört ausgeräumt: Es gibt keinen flächendeckend freien Eintritt in allen Bundesmuseen am Nationalfeiertag. Manche Häuser sind gratis, andere nur ermäßigt, wieder andere ganz normal kostenpflichtig. Das hat sich über die Jahre verschoben, und welche Museen heuer mitmachen, steht üblicherweise erst Mitte Oktober fest.',
  whatToExpectList: [
    'Geschlossen: Geschäfte und Supermärkte, Ämter und Behörden, Banken, Post, Schulen',
    'Offen: Gastronomie, Tankstellen, Bahnhofs- und Flughafenshops, die meisten Museen und Freizeiteinrichtungen',
    'Öffis: Betrieb nach Sonn- und Feiertagsfahrplan',
    'Freier Museumseintritt gilt nicht pauschal, sondern nur für einzelne Häuser',
    'Tage der offenen Tür in Parlament, Hofburg und Ministerien werden meist Anfang Oktober angekündigt',
    'Ein Wermutstropfen: Allerheiligen fällt 2026 auf einen Sonntag, und Österreich kennt keinen Ersatzruhetag',
  ],
  practicalInfoTitle: 'Praktische Infos zum langen Wochenende',
  practicalInfo: [
    {
      icon: '📅',
      label: 'Nationalfeiertag',
      text: 'Montag, 26. Oktober 2026. Gesetzlicher, arbeitsfreier Feiertag in ganz Österreich.',
    },
    {
      icon: '🎒',
      label: 'Herbstferien',
      text: 'Dienstag 27. bis Samstag 31. Oktober 2026, einheitlich in allen neun Bundesländern. Weil der 26. Oktober auf einen Montag fällt, bleiben den Schulen heuer höchstens drei schulautonome Tage.',
    },
    {
      icon: '🗓️',
      label: 'Zehn Tage am Stück',
      text: 'Von Samstag 24. Oktober bis Montag 2. November ist durchgehend schulfrei: Wochenende, Nationalfeiertag, Herbstferien, Halloween, Allerheiligen und Allerseelen.',
    },
    {
      icon: '💼',
      label: 'Urlaubstrick',
      text: 'Mit vier Urlaubstagen von Dienstag 27. bis Freitag 30. Oktober kommst du auf neun freie Tage am Stück, von 24. Oktober bis 1. November. Eines der effizientesten Urlaubsfenster des Jahres.',
    },
    {
      icon: '🚆',
      label: 'Öffis',
      text: 'Am 26. Oktober gilt der Sonn- und Feiertagsfahrplan. Das ist der Punkt, an dem die meisten Ausflugspläne scheitern.',
    },
    {
      icon: '🌧️',
      label: 'Schlechtwetterplan',
      text: 'Thermen, Museen, Indoorspielplätze, Kletterhallen und Trampolinparks sind in dieser Woche erfahrungsgemäß voll. Wer hin will, bucht besser vorher.',
    },
    {
      icon: '🐄',
      label: 'Was nicht mehr geht',
      text: 'Almabtriebe. Die finden von September bis Anfang Oktober statt. In den Herbstferien ist das Vieh längst im Tal.',
    },
  ],
  gallery: [],
  faqs: [
    {
      question: 'Ist der 26. Oktober 2026 ein Feiertag?',
      answer: 'Ja, ein gesetzlicher, arbeitsfreier Feiertag in ganz Österreich. 2026 fällt er auf einen Montag.',
    },
    {
      question: 'Haben am Nationalfeiertag die Geschäfte offen?',
      answer: 'Nein. Supermärkte und Geschäfte sind geschlossen. Offen sind Gastronomie, Tankstellen sowie Bahnhofs- und Flughafenshops.',
    },
    {
      question: 'Sind am Nationalfeiertag alle Museen gratis?',
      answer: 'Nein, das ist ein verbreiteter Irrtum. Einige Häuser bieten freien Eintritt, andere nur eine Ermäßigung, wieder andere gar nichts. Welche Museen heuer mitmachen, wird üblicherweise erst Mitte Oktober bekannt gegeben.',
    },
    {
      question: 'Wann sind die Herbstferien 2026?',
      answer: 'Von Dienstag, 27. Oktober, bis Samstag, 31. Oktober 2026, einheitlich in allen neun Bundesländern.',
    },
    {
      question: 'Wie viele Tage sind 2026 rund um den Nationalfeiertag schulfrei?',
      answer: 'Zehn: von Samstag, 24. Oktober, bis Montag, 2. November.',
    },
    {
      question: 'Ist Allerseelen in Österreich ein Feiertag?',
      answer: 'Nein, der 2. November ist kein gesetzlicher Feiertag. Geschäfte und Ämter haben regulär offen. Schulfrei ist er 2026 aber.',
    },
    {
      question: 'Wie bekomme ich mit wenig Urlaub viele freie Tage?',
      answer: 'Mit vier Urlaubstagen von Dienstag, 27., bis Freitag, 30. Oktober kommst du auf neun freie Tage am Stück, von 24. Oktober bis 1. November.',
    },
  ],
  ctaText: 'Ausflüge und Events in den Herbstferien finden',
  ctaLink: '/entdecken',
  seoTitle: 'Nationalfeiertag 26. Oktober 2026: Was offen ist und was los ist',
  seoDescription:
    'Der Nationalfeiertag 2026 fällt auf einen Montag und startet zehn schulfreie Tage. Was geöffnet hat, wie die Öffis fahren und was in den Herbstferien läuft.',
  keywords: [
    'nationalfeiertag 2026',
    'nationalfeiertag was ist offen',
    'nationalfeiertag österreich',
    '26. oktober feiertag',
    'herbstferien 2026',
    'herbstferien ausflug',
  ],
  jsonLdEvent: {
    name: 'Nationalfeiertag Österreich 2026',
    startDate: '2026-10-26T00:00:00+02:00',
    endDate: '2026-10-26T23:59:00+02:00',
    location: 'Österreich',
    addressCountry: 'AT',
    url: 'https://lasstreffen.at/blog/nationalfeiertag-oesterreich',
    description:
      'Der österreichische Nationalfeiertag am 26. Oktober 2026 ist ein gesetzlicher, arbeitsfreier Feiertag und startet die Herbstferien.',
    image: 'https://lasstreffen.at/images/blog/nationalfeiertag-oesterreich/hero.jpg',
  },
  stayCity: 'Wien',
};
