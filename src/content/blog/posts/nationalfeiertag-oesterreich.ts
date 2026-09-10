import type { FestivalPost } from '../types';

// Saison-Seite (fn-24), Frist laut SAISON_KALENDER: liveBy 10-01.
// Feiertags- und Ferientermine stammen aus den geprüften `facts` des
// Kalenders (Primärquellen BMB-Ferientermine und RIS), verifiziert am
// 2026-09-10. Die Programm-Tipps pro Bundesland sind echte Events aus
// der eigenen Datenbank, kein Modell-Output.
//
// Bewusst KEINE Liste von Museen mit freiem Eintritt: die wechselt
// jährlich und war zum Redaktionsschluss nicht bestätigt.
export const post: FestivalPost = {
  slug: 'nationalfeiertag-oesterreich',
  title: 'Nationalfeiertag 2026: Montag, 26. Oktober',
  subtitle: 'Zehn freie Tage am Stück und was du in jedem Bundesland damit anfangen kannst',
  heroImage: '/images/blog/nationalfeiertag-oesterreich/hero.jpg',
  heroImageCredit: 'Foto: Gerd Eichmann, CC BY-SA 4.0, Wikimedia Commons',
  publishDate: '2026-09-10',
  updatedDate: '2026-09-10',
  readingTime: 8,
  excerpt:
    'Der Nationalfeiertag 2026 fällt auf einen Montag und startet zehn schulfreie Tage. Was in jedem Bundesland läuft, was am Feiertag offen hat und wie du mit vier Urlaubstagen auf neun freie kommst.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-red-700 text-white',
  keyFacts: {
    dates: 'Montag, 26. Oktober 2026, Herbstferien 27. bis 31. Oktober',
    location: 'Ganz Österreich, alle neun Bundesländer',
    address: 'Zentrale Veranstaltungen traditionell am Heldenplatz in Wien',
    genre: 'Feiertag, Herbstferien, Familienausflüge, Kultur',
    price: 'Viele Programmpunkte kostenlos',
    website: 'https://www.bmb.gv.at/Themen/schule/schulpraxis/termine/ferientermine_26_27.html',
    since: '1965',
  },
  lineup: [
    { name: 'Circus Roncalli, Innsbruck', role: 'headliner', day: '25., 26. Oktober und 1. November', stage: 'Tirol' },
    { name: 'Cirque du Soleil OVO, Salzburgarena', role: 'headliner', day: '25. Oktober', stage: 'Salzburg' },
    { name: 'Josef Hader "Hader On Ice", Helmut List Halle Graz', role: 'headliner', day: '24. Oktober', stage: 'Steiermark' },
    { name: 'Vivaldi, Vier Jahreszeiten in der Karlskirche Wien', role: 'special', day: '28. Oktober', stage: 'Wien' },
    { name: 'Der Revisor, Akademietheater Wien', role: 'special', day: '26. Oktober', stage: 'Wien' },
    { name: 'Alfred Dorfer "GLEICH"', role: 'special', day: '26. Oktober', stage: 'Niederösterreich' },
    { name: 'Alexander Eder Unplugged, Brucknerhaus Linz', role: 'special', day: '24. Oktober', stage: 'Oberösterreich' },
    { name: 'Harry G "HoamStories", Konzerthaus Klagenfurt', role: 'special', day: '28. Oktober', stage: 'Kärnten' },
    { name: 'Symphonieorchester Vorarlberg, Feldkirch', role: 'special', day: '24. Oktober', stage: 'Vorarlberg' },
    { name: 'Dracula auf Burg Lockenhaus', role: 'special', day: '24. und 31. Oktober', stage: 'Burgenland' },
    { name: 'Altstadt-Rundgang Graz', role: 'support', day: '25. Oktober', stage: 'Steiermark' },
    { name: 'Klavierkonzert im Franziskanerkloster Salzburg', role: 'support', day: '27. und 28. Oktober', stage: 'Salzburg' },
  ],
  lineupTitle: 'Was in der Ferienwoche läuft, Bundesland für Bundesland',
  lineupNote:
    'Ein Ausschnitt aus unserem Kalender, Stand September. Bis Mitte Oktober kommen laufend Termine dazu, gerade die von Gemeinden und Vereinen. Aktuelle Zeiten und Preise stehen jeweils auf der Event-Seite.',
  intro:
    'Beim Nationalfeiertag ist 2026 alles günstig gelegen: Der 26. Oktober fällt auf einen Montag, direkt danach beginnen die Herbstferien, und am Sonntag darauf folgt Allerheiligen. Zehn freie Tage am Stück. Die Frage ist also weniger, ob du Zeit hast, sondern was du damit anfängst. Hier steht beides: was in deinem Bundesland läuft und was am Feiertag selbst offen hat.',
  historyTitle: 'Warum überhaupt der 26. Oktober',
  history:
    'Am 26. Oktober 1955 beschloss der Nationalrat das Bundesverfassungsgesetz über die immerwährende Neutralität Österreichs, einen Tag nachdem der letzte alliierte Soldat das Land verlassen hatte. Zum Nationalfeiertag wurde das Datum aber erst zehn Jahre später, mit dem Bundesgesetz vom 25. Oktober 1965. Und arbeitsfrei war der Tag anfangs nicht: Bis 1967 war er lediglich schulfrei. Erst ein Bundesgesetz vom 28. Juni 1967 machte den 26. Oktober zum arbeitsfreien Feiertag.',
  whatToExpectTitle: 'Was du in den zehn Tagen machen kannst',
  whatToExpect:
    'Die Ferienwoche ist die dichteste Kulturwoche des Herbstes, weil Veranstalter genau auf sie hin programmieren. Zwei große Zirkusproduktionen sind gleichzeitig im Land, Circus Roncalli in Innsbruck und Cirque du Soleil in der Salzburgarena. Das Kabarett hat Hochsaison, von Josef Hader in Graz über Alfred Dorfer in Niederösterreich bis Harry G in Klagenfurt. Dazu kommen die Klassiker der Woche: Museen und Schaubetriebe mit Ferienprogramm, Thermen, und ab dem letzten Oktoberwochenende überlagert sich alles mit der Halloween-Saison. Wer lieber draußen ist, hat mit dem späten Oktober meist noch brauchbares Wanderwetter in den Tallagen, während oben schon der erste Schnee liegt.',
  whatToExpectList: [
    'Zirkus als Familienfixpunkt: Circus Roncalli in Innsbruck und Cirque du Soleil OVO in Salzburg laufen beide in der Ferienwoche',
    'Kabarett und Comedy haben Hochsaison, unter anderem Josef Hader in Graz, Alfred Dorfer in Niederösterreich und Harry G in Klagenfurt',
    'Klassik in besonderen Räumen: Vivaldi in der Wiener Karlskirche, Klavierkonzerte im Salzburger Franziskanerkloster, das Symphonieorchester Vorarlberg in Feldkirch',
    'Stadtführungen und Museumsprogramme, etwa der Altstadt-Rundgang in Graz',
    'Gruseliges für die zweite Wochenhälfte: Dracula auf Burg Lockenhaus im Burgenland, passend zum Übergang in die Halloween-Woche',
    'Thermen und Indoor-Klassiker als Schlechtwetterplan, in dieser Woche allerdings gut besucht',
    'Am Feiertag selbst: die Tage der offenen Tür in Parlament, Hofburg und Ministerien, deren Programm meist Anfang Oktober veröffentlicht wird',
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
      icon: '🔒',
      label: 'Am Feiertag geschlossen',
      text: 'Geschäfte und Supermärkte, Ämter und Behörden, Banken, Post und Schulen.',
    },
    {
      icon: '🔓',
      label: 'Am Feiertag offen',
      text: 'Gastronomie, Tankstellen, Bahnhofs- und Flughafenshops sowie die meisten Museen und Freizeiteinrichtungen. Einen flächendeckend freien Museumseintritt gibt es entgegen dem verbreiteten Irrtum nicht: manche Häuser sind gratis, andere nur ermäßigt, wieder andere ganz normal kostenpflichtig. Welche heuer mitmachen, steht üblicherweise erst Mitte Oktober fest.',
    },
    {
      icon: '🚆',
      label: 'Öffis',
      text: 'Am 26. Oktober gilt der Sonn- und Feiertagsfahrplan. Das ist der Punkt, an dem die meisten Ausflugspläne scheitern, gerade auf dem Rückweg vom Land.',
    },
    {
      icon: '🎟️',
      label: 'Rechtzeitig buchen',
      text: 'Zirkus, Kabarett und Gruseldinner in dieser Woche sind regelmäßig schon Anfang Oktober ausverkauft. Wenn du etwas Bestimmtes vorhast, buche früh.',
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
      question: 'Was kann man am Nationalfeiertag unternehmen?',
      answer: 'Die meisten Museen und Freizeiteinrichtungen haben offen, dazu gibt es die Tage der offenen Tür in Parlament, Hofburg und Ministerien. In der Woche danach laufen Circus Roncalli in Innsbruck, Cirque du Soleil in Salzburg sowie viel Kabarett und Klassik in allen Bundesländern.',
    },
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
      question: 'Was macht man in den Herbstferien mit Kindern?',
      answer: 'Die beiden großen Zirkusproduktionen der Woche sind Circus Roncalli in Innsbruck und Cirque du Soleil OVO in der Salzburgarena. Dazu kommen Museums- und Ferienprogramme, Thermen und ab dem letzten Wochenende die Halloween-Veranstaltungen.',
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
  ctaText: 'Alle Events in den Herbstferien finden',
  ctaLink: '/entdecken',
  seoTitle: 'Nationalfeiertag 26. Oktober 2026: Was offen ist und was läuft',
  seoDescription:
    'Der Nationalfeiertag 2026 fällt auf einen Montag und startet zehn schulfreie Tage. Programm in allen neun Bundesländern, was geöffnet hat und der Urlaubstrick.',
  keywords: [
    'nationalfeiertag 2026',
    'nationalfeiertag was ist offen',
    'nationalfeiertag österreich',
    '26. oktober feiertag',
    'herbstferien 2026',
    'herbstferien ausflug',
    'herbstferien mit kindern',
  ],
  // Das Zeitfenster ist hier das Relevanzsignal, nicht der Titel: gesucht
  // wird "was kann ich in dieser Woche machen".
  relatedEvents: {
    terms: ['circus', 'roncalli', 'cirque', 'kabarett', 'museum', 'theater', 'konzert', 'familien'],
    from: '2026-10-24',
    to: '2026-11-03',
    categories: ['Kultur & Bühne', 'Familie & Kinder', 'Märkte & Feste', 'Musik'],
  },
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
