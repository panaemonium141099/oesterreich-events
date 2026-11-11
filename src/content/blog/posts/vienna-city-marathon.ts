import type { FestivalPost } from '../types';

// Termine 2026/2027, Start/Ziel, Bewerbe, Teilnahmebeiträge 2027, Anmeldestand, Strecke,
// Anreise, Gründung und Website geprüft am 2026-10-28 gegen vienna-marathon.com (?go=marathon,
// ?go=halfmarathon, ?go=relay, ?go=vienna10k: Sonntag, 18. April 2027, Start Wagramer
// Straße/Reichsbrücke, Ziel Ringstraße/Burgtheater, Beiträge 155/130/250 (Team)/55 Euro,
// „Ein Preis für alle“; Anmeldung Marathon am 20.09.2026, Halbmarathon am 02.09.2026,
// Staffel am 22.09.2026 geschlossen, Warteliste; ?go=course: Ziel zwischen Burgtheater und
// Rathausplatz, Höhendifferenz 44 Meter, Prater Hauptallee km 28 bis 34, Linke Wienzeile,
// Schönbrunn, Mariahilfer Straße; ?go=arrive: U1 Kaisermühlen/VIC und Alte Donau, Renntag
// 19. April 2026; ?go=events: 44. VCM 2027), wien.orf.at/stories/3375544/ (2027 Rekord von
// 15.000 Marathon-Anmeldungen, rund 50.000 Teilnehmende erwartet) und
// de.wikipedia.org/wiki/Vienna_City_Marathon (seit 1984). Falsch waren: Ziel „Heldenplatz“
// (richtig Ringstraße zwischen Burgtheater und Rathausplatz), „Anmeldung ab September des
// Vorjahres“ und „Early-Bird-Preise“ (Einheitspreis, Anmeldung im September schon geschlossen),
// Preise „ab ca. € 100/65/35“, „km 30 bis 35 entlang der Ringstraße“ (dort Prater Hauptallee),
// „Elitefeld als Vorabrennen“. Nicht belegt und entfernt: „250.000 Zuschauer“, „120 Nationen“,
// „zehn größten Marathons Europas“, „Europameisterschaften“, Event-Village am Heldenplatz,
// Temperaturangaben.
export const post: FestivalPost = {
  slug: 'vienna-city-marathon',
  title: 'Vienna City Marathon',
  subtitle: 'Von der Reichsbrücke durch den Prater, an Schönbrunn vorbei bis zum Ziel vor dem Burgtheater',
  heroImage: '/images/blog/vienna-city-marathon/hero.jpg',
  thumbnailImage: '/images/blog/vienna-city-marathon/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-28',
  factSources: {
    checkedAt: '2026-10-28',
    urls: [
      'https://www.vienna-marathon.com/?go=marathon',
      'https://www.vienna-marathon.com/?go=course',
      'https://www.vienna-marathon.com/?go=halfmarathon',
      'https://www.vienna-marathon.com/?go=relay',
      'https://www.vienna-marathon.com/?go=vienna10k',
      'https://wien.orf.at/stories/3375544/',
      'https://www.vienna-marathon.com/?go=events',
      'https://www.vienna-marathon.com/?go=arrive',
      'https://de.wikipedia.org/wiki/Vienna_City_Marathon',
      'https://www.vienna-marathon.com/?go=streckenhighlights',
    ],
  },
  readingTime: 6,
  excerpt:
    'Der Vienna City Marathon findet 2027 am Sonntag, 18. April statt. Die Strecke führt von der Reichsbrücke durch den Prater und an Schönbrunn vorbei bis zur Ringstraße vor dem Burgtheater. Für 2027 meldeten sich 15.000 Läuferinnen und Läufer allein für den Marathon an.',
  category: 'Sport & Outdoor',
  categoryColor: 'bg-blue-600 text-white',
  keyFacts: {
    dates: 'Sonntag, 18. April 2027 (2026: Sonntag, 19. April)',
    location: 'Start: Wagramer Straße/Reichsbrücke; Ziel: Ringstraße/Burgtheater',
    address: 'Start: Wagramer Straße, 1220 Wien; Ziel: Ringstraße zwischen Burgtheater und Rathausplatz, 1010 Wien',
    genre: 'Marathon, Halbmarathon, Staffelmarathon, 10 km, 5 km, Kinderläufe',
    price: 'Marathon € 155 | Halbmarathon € 130 | Staffel € 250 pro Team | 10 km € 55 (2027)',
    website: 'https://www.vienna-marathon.com',
    capacity: '2027: 15.000 Anmeldungen für den Marathon, rund 50.000 Teilnehmende in allen Bewerben erwartet',
    since: '1984',
  },
  lineup: [
    { name: 'Marathon (42,195 km)', role: 'headliner', day: 'Sonntag, ab 9 Uhr', stage: 'Reichsbrücke bis Burgtheater' },
    { name: 'Wiener Städtische Halbmarathon (21,1 km)', role: 'headliner', day: 'Sonntag, ab 9 Uhr', stage: 'Reichsbrücke bis Burgtheater' },
    { name: 'Powerade Staffelmarathon (Teams zu viert)', role: 'support', day: 'Sonntag, ab 9 Uhr', stage: 'Reichsbrücke bis Burgtheater' },
    { name: 'Tchibo Coffee Run 10K', role: 'support', day: 'Sonntag, 8 Uhr', stage: 'Reichsbrücke bis Burgtheater' },
    { name: 'Vienna 5K und Kinderläufe', role: 'special', day: 'Samstag', stage: 'Ringstraße' },
  ],
  lineupTitle: 'Bewerbe',
  lineupNote: 'Alle Bewerbe, Startzeiten und Teilnahmebedingungen stehen auf vienna-marathon.com.',
  intro:
    'Seit 1984 läuft Wien jedes Frühjahr beim Vienna City Marathon. Die Strecke beginnt auf der Reichsbrücke, führt durch den Prater, über die Ringstraße, entlang der Linken Wienzeile bis Schönbrunn, über die Mariahilfer Straße und zurück in die Prater Hauptallee, bevor das Ziel auf der Ringstraße vor dem Burgtheater wartet. Wer keinen Marathon laufen will, ist beim Halbmarathon, in der Staffel, beim 10K am Sonntag oder beim Vienna 5K am Samstag dabei, oder feuert einfach von der Strecke aus an.',
  historyTitle: 'Seit 1984 durch Wien',
  history:
    'Der erste Vienna City Marathon wurde 1984 gelaufen, 2027 steht die 44. Ausgabe an. Die Strecke ist flach: Zwischen dem tiefsten und dem höchsten Punkt liegen nur 44 Meter. Ein Herzstück ist die Prater Hauptallee, auf der Eliud Kipchoge 2019 als erster Mensch einen Marathon unter zwei Stunden lief. Marathon, Halbmarathon und Vienna 5K sind von der AIMS vermessen und stehen im World Athletics Global Calendar.',
  whatToExpectTitle: 'Was erwartet dich beim Vienna City Marathon?',
  whatToExpect:
    'Gestartet wird in sechs Blöcken zwischen 9 und 9.25 Uhr an der Wagramer Straße. Nach der Reichsbrücke geht es in den Prater und über die Ringstraße zur Linken Wienzeile, dann bis Schönbrunn und über die Mariahilfer Straße zurück Richtung Innenstadt. Zwischen Kilometer 28 und 34 laufen die Marathonis durch die Prater Hauptallee. Das Ziel aller Sonntagsbewerbe liegt auf der Ringstraße zwischen Burgtheater und Rathausplatz. Entlang der Strecke gibt es laut Veranstalter mehr als 65 Stellen mit Musik und Unterhaltung.',
  whatToExpectList: [
    'Flache Strecke mit nur 44 Metern Höhenunterschied',
    'Passagen: Reichsbrücke, Prater Hauptallee, Ringstraße, Linke Wienzeile, Schönbrunn, Mariahilfer Straße',
    'Mehr als 65 Stellen mit Musik und Unterhaltung entlang der Strecke',
    'Ziel auf der Ringstraße zwischen Burgtheater und Rathausplatz',
    'Zielschluss Marathon 15.30 Uhr, Halbmarathon 13 Uhr',
    'Startnummernausgabe in der Marx Halle, Karl-Farkas-Gasse 19, 1030 Wien',
  ],
  practicalInfoTitle: 'Praktische Infos für Läufer und Zuschauer',
  practicalInfo: [
    {
      icon: '📝',
      label: 'Anmeldung',
      text: 'Für 2027 sind Marathon, Halbmarathon und Staffel seit September 2026 ausgebucht, es gibt Wartelisten. Es gilt ein Einheitspreis ohne Frühbucherstufen.',
    },
    {
      icon: '🚇',
      label: 'Anreise',
      text: 'Zum Start an der Wagramer Straße mit der U1 bis Kaisermühlen/VIC oder Alte Donau. Ins Ziel am Burgtheater mit der U2 bis Schottentor oder der U3 bis Volkstheater oder Herrengasse.',
    },
    {
      icon: '👟',
      label: 'Vorbereitung',
      text: 'Für den Marathon braucht es mehrere Monate gezieltes Training. Der Veranstalter bietet dafür wöchentliche VCM Training Runs und eine Winterlaufserie in der Prater Hauptallee an.',
    },
    {
      icon: '🏆',
      label: 'Tipp für Zuschauer',
      text: 'Die Prater Hauptallee (Marathon zwischen Kilometer 28 und 34) und der Zieleinlauf vor dem Burgtheater sind beliebte Plätze. Eine Karte der Wiener Linien für Fans zeigt die besten Wege entlang der Strecke.',
    },
  ],
  gallery: [],
  ctaText: 'Sportevents in Wien entdecken',
  ctaLink: '/map?category=Sport&region=Wien',
  seoTitle: 'Vienna City Marathon 2027: Termin, Strecke und Anmeldung',
  seoDescription:
    'Vienna City Marathon 2027 am Sonntag, 18. April: Strecke von der Reichsbrücke zum Burgtheater, Bewerbe, Startgebühren, Anmeldung und Tipps für Läufer und Zuschauer.',
  keywords: [
    'Vienna City Marathon',
    'Wien Marathon 2027',
    'Vienna Marathon Anmeldung',
    'Marathon Wien April',
    'Halbmarathon Wien',
    '10km Lauf Wien',
    'Laufevent Wien',
    'Wien Marathon Strecke',
    'VCM 2027',
    'Staffelmarathon Wien',
  ],
  faqs: [
    {
      question: 'Kann ich mich noch für den Vienna City Marathon 2027 anmelden?',
      answer: 'Marathon, Halbmarathon und Staffelmarathon sind für 2027 ausgebucht: Die Anmeldung schloss im September 2026, seither gibt es Wartelisten. Startplätze für weitere Bewerbe wie 10K oder 5K und alle Fristen findest du auf vienna-marathon.com. Der Teilnahmebeitrag ist ein Einheitspreis, Frühbucherrabatte gibt es nicht.',
    },
    {
      question: 'Wie verläuft die Marathonstrecke durch Wien?',
      answer: 'Start ist an der Wagramer Straße bei der Reichsbrücke im 22. Bezirk. Die Strecke führt durch den Prater, über die Ringstraße und die Linke Wienzeile bis Schönbrunn, über die Mariahilfer Straße zurück, dann durch die Prater Hauptallee und schließlich zum Ziel auf der Ringstraße zwischen Burgtheater und Rathausplatz. Der Höhenunterschied beträgt nur 44 Meter.',
    },
    {
      question: 'Wo sind die besten Plätze für Zuschauer?',
      answer: 'Beliebt sind der Start an der Reichsbrücke, die Prater Hauptallee, durch die der Marathon zwischen Kilometer 28 und 34 führt, und der Zieleinlauf vor dem Burgtheater. Eine Karte der Wiener Linien für Fans zeigt, wie man mit U-Bahn oder Rad von Punkt zu Punkt kommt.',
    },
    {
      question: 'Wie viel kostet die Teilnahme 2027?',
      answer: 'Laut Veranstalter kostet der Marathon 155 Euro, der Halbmarathon 130 Euro, der Staffelmarathon 250 Euro pro Team und der 10K 55 Euro. Die Garderobeabgabe ist um 3 Euro vorab zu buchen.',
    },
  ],
  jsonLdEvent: {
    name: 'Vienna City Marathon 2027',
    startDate: '2027-04-18',
    endDate: '2027-04-18',
    location: 'Wagramer Straße, 1220 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://www.vienna-marathon.com',
    description:
      'Der Vienna City Marathon führt von der Reichsbrücke durch den Prater und an Schönbrunn vorbei bis zum Ziel auf der Ringstraße vor dem Burgtheater.',
    image:
      'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=1600&q=85&auto=format&fit=crop',
  },
};
