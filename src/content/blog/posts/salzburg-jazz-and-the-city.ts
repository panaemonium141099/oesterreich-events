import type { FestivalPost } from '../types';

// Termin 2026, Eintritt, Umfang, Programm und Website geprüft am 2026-10-27 gegen
// salzburg-altstadt.at/de/salzburgjazz (Altstadtverband Salzburg, Ziel von
// salzburgjazz.com), salzburg.info/en/events/highlights/jazz-and-the-city und
// salzburgerland.com/de/magazin/es-jazzt-und-swingt-in-salzburg. Vorher stand hier im
// April Geschätztes und Erfundenes: 22. bis 26. Oktober (tatsächlich 15. bis 18.10.),
// fünf Tage mit über 100 Konzerten, Gründung 2002 durch eine „Salzburg Foundation“
// (die Seite nennt nur „seit mehr als 25 Jahren“), 50.000 Besucher, Festival-Shuttle,
// Website jazzandthecity.at (Domain existiert nicht) und ein ausgedachtes Line-up
// (Paolo Fresu, Cory Henry, Susi Hyldgaard, Klangspuren Ensemble). Termin 2027 ist
// noch nicht veröffentlicht.
export const post: FestivalPost = {
  slug: 'salzburg-jazz-and-the-city',
  title: 'Jazz & The City Salzburg',
  subtitle: 'Musik-Entdeckerfestival bei freiem Eintritt in den Kirchen, Plätzen, Bars und Kellern der Salzburger Altstadt',
  heroImage: '/images/blog/salzburg-jazz-and-the-city/hero.jpg',
  thumbnailImage: '/images/blog/salzburg-jazz-and-the-city/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.salzburg-altstadt.at/de/salzburgjazz',
      'https://www.salzburgerland.com/de/magazin/es-jazzt-und-swingt-in-salzburg',
      'https://www.salzburg24.at/anzeigen/jazzthecitysounds-15-bis-18-oktober-2026-art-339877',
      'https://www.salzburg-altstadt.at/de/salzburgjazz/programm',
      'https://salzburg.info/en/events/highlights/jazz-and-the-city',
    ],
  },
  readingTime: 5,
  excerpt:
    'Jedes Jahr im Oktober bespielt Jazz&TheCity sounds die Salzburger Altstadt: 2026 waren es von 15. bis 18. Oktober rund 60 Acts mit etwa 140 Musikerinnen und Musikern an 20 Spielorten, bei freiem Eintritt mitten im UNESCO-Welterbe.',
  category: 'Musik & Konzerte',
  categoryColor: 'bg-blue-700 text-white',
  keyFacts: {
    dates: '15. bis 18. Oktober 2026 (Pre-Opening am 14. Oktober). Termin 2027 folgt',
    location: 'Altstadt Salzburg (rund 20 Spielorte)',
    address: 'Altstadt, 5020 Salzburg',
    genre: 'Jazz, Weltmusik, Singer-Songwriter, Neue Musik',
    price: 'Eintritt frei (ohne Tickets, first come, first served)',
    website: 'https://www.salzburg-altstadt.at/de/salzburgjazz',
  },
  lineup: [
    { name: 'Yemen Blues', role: 'headliner', stage: 'Residenzplatz' },
    { name: 'Les Frères Smith', role: 'headliner', stage: 'Residenzplatz' },
    { name: 'Noura Mint Seymali', role: 'special' },
    { name: 'Bab L’ Bluz', role: 'special' },
    { name: 'Ernst Molden & die Neuen Wiener Concert Schrammeln', role: 'special' },
    { name: 'Andy Sheppard Trio', role: 'special' },
    { name: 'Salzburg Mozarteum Marching Band', role: 'support', stage: 'Altstadt' },
  ],
  lineupNote:
    'Auswahl aus dem Programm 2026 laut Veranstalter (Reihen City Stories, The Soul of Jazz, The Art of Solo, String-Break und Open-Air-Bühne am Residenzplatz). Das Programm 2027 ist noch nicht veröffentlicht. Der Eintritt zu allen Programmpunkten ist frei, Tickets gibt es keine.',
  intro:
    'Jazz&TheCity sounds ist das Musikfestival der Salzburger Altstadt: vier Tage im Oktober, Konzerte in Kirchen, auf Plätzen, in Kellern, Bars und Cafés, und das alles bei freiem Eintritt. 2026 standen von 15. bis 18. Oktober rund 60 Acts mit etwa 140 Künstlerinnen und Künstlern an 20 Spielorten auf dem Programm, Motto „true moments“. Die Musikerinnen und Musiker kamen unter anderem aus den USA, Italien, Frankreich, Spanien, Kolumbien, dem Iran, Mauretanien, den Niederlanden, Marokko, dem Jemen, Israel und der Türkei, dazu viele aus Österreich.',
  historyTitle: 'Seit über 25 Jahren Jazz in der Welterbe-Stadt',
  history:
    'Jazz&TheCity ist laut Veranstalter seit mehr als 25 Jahren ein fixer Termin im Veranstaltungskalender der Salzburger Altstadt. Hinter dem Festival steht der Altstadtverband Salzburg. Über die Jahre hat es sich zu einem international bekannten Musik-Entdeckerfestival entwickelt; 2026 knüpfte ein Pre-Opening in ausgewählten Altstadt-Lokalen an die Anfänge des Festivals an. Kooperationspartner sind unter anderem die Universität Mozarteum, 2026 kam das Musikum Salzburg neu dazu.',
  whatToExpectTitle: 'Was Jazz & The City bietet',
  whatToExpect:
    'Das Festival bespielt große und kleine Orte in Gehweite zueinander: 2026 unter anderem den Residenzplatz mit der Open-Air-Bühne, die Kollegienkirche, das DomQuartier, den Stieglkeller, die Universität Mozarteum, den Zwergelgartenpavillon und den Jazzit:Musik:Club. Das Programm ist in Reihen gegliedert, von Jazz über Weltmusik bis zu Solo- und Saitenprojekten, dazu Jazz-Brunch, Jazz-Frühschoppen und ein Kinderprogramm.',
  whatToExpectList: [
    'Rund 60 Acts an 20 Spielorten (2026), alle bei freiem Eintritt',
    'Open-Air-Bühne am Residenzplatz',
    'Konzerte in Kirchen, Kellern, Bars und Cafés',
    'Programmreihen: City Stories, The Soul of Jazz, The Art of Solo, String-Break',
    'Hidden Tracks: geführte Rundgänge mit Musik',
    'Jazz-Brunch, Jazz-Frühschoppen und Kinderprogramm',
  ],
  practicalInfoTitle: 'Praktische Infos für Festivalbesucher',
  practicalInfo: [
    {
      icon: '🎷',
      label: 'Eintritt',
      text: 'Alle Programmpunkte sind frei zugänglich. Es gibt keine Tickets oder Zählkarten, es gilt „first come, first served“. Die Personenzahl je Spielort richtet sich nach den gesetzlichen Vorgaben.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Salzburg HBF, dann 15 Minuten Fußweg in die Altstadt. Empfehlung: Öffentliche Verkehrsmittel, da Parkplätze in der Altstadt sehr begrenzt sind.',
    },
    {
      icon: '🗺️',
      label: 'Festival-App',
      text: 'Die Altstadt Event-App (iOS und Android) zeigt das Programm, erstellt einen persönlichen Zeitplan und erinnert 15 Minuten vor Beginn an gemerkte Konzerte.',
    },
    {
      icon: '🧥',
      label: 'Wetter',
      text: 'Oktober in Salzburg: 8 bis 15 °C, möglicher Regen. Wetterfeste Jacke mitbringen, da viele Konzerte im Freien stattfinden.',
    },
  ],
  gallery: [],
  ctaText: 'Musik-Events in Salzburg entdecken',
  ctaLink: '/map?bundesland=Salzburg&category=Musik',
  seoTitle: 'Jazz & The City Salzburg 2026: Programm & Tipps',
  seoDescription:
    'Jazz & The City Salzburg 2026 von 15. bis 18. Oktober: rund 60 Acts an 20 Spielorten in der Altstadt, Eintritt frei. Programm, Spielorte und Tipps.',
  keywords: [
    'Jazz The City Salzburg 2026',
    'Jazzfestival Salzburg',
    'Salzburg Jazz Oktober',
    'Gratis Konzerte Salzburg',
    'Jazz & The City Programm',
    'Musik Festival Salzburg Herbst',
    'Open Air Jazz Österreich',
    'Salzburg Altstadt Festival',
    'Jazzfestival Österreich kostenlos',
    'Jazz Konzerte Oktober 2026',
  ],
  jsonLdEvent: {
    name: 'Jazz & The City Salzburg 2026',
    startDate: '2026-10-15',
    endDate: '2026-10-18',
    location: 'Residenzplatz, 5020 Salzburg, Austria',
    addressCountry: 'AT',
    url: 'https://www.salzburg-altstadt.at/de/salzburgjazz',
    description:
      'Jazz & The City ist ein Musikfestival bei freiem Eintritt in der Salzburger Altstadt mit rund 60 Acts an 20 Spielorten über vier Tage (2026).',
    image:
      'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=1600&q=85&auto=format&fit=crop',
  },
};
