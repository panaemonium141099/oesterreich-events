import type { FestivalPost } from '../types';

export const post: FestivalPost = {
  slug: 'salzburger-dult',
  title: 'Salzburger Dult',
  subtitle: 'Traditionelles Volksfest mit Fahrgeschäften, Kulinarik und Salzburger Volkskultur',
  heroImage: '/images/blog/salzburger-dult/hero.jpg',
  thumbnailImage: '/images/blog/salzburger-dult/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-04-01',
  readingTime: 5,
  excerpt:
    'Zweimal jährlich öffnet die Salzburger Dult ihre Tore: im Frühling und im Herbst. Das traditionsreiche Volksfest auf dem Volksgartenparkplatz vereint Fahrgeschäfte, Marktstände und echte Salzburger Gemütlichkeit.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-yellow-600 text-white',
  keyFacts: {
    dates: 'Frühling: Mai 2026 / Herbst: September 2026',
    location: 'Volksgarten, Salzburg',
    address: 'Volksgartenparkplatz, 5020 Salzburg',
    genre: 'Volksfest, Kirmes, Kulinarik, Familienunterhaltung',
    price: 'Eintritt frei (Fahrgeschäfte kostenpflichtig)',
    website: 'https://www.salzburg.gv.at',
    capacity: 'bis zu 80.000 Besucher pro Dult',
    since: '18. Jahrhundert',
  },
  lineup: [
    { name: 'Salzburger Landesmusikkapelle', role: 'special', stage: 'Festzelt' },
    { name: 'Trachtenkapelle Salzburg-Maxglan', role: 'support', stage: 'Marktplatz' },
    { name: 'Tanzgruppe Salzburger Volkstanzkreis', role: 'special', stage: 'Festzelt' },
    { name: 'Unterhaltungskapelle Salzkammergut', role: 'support', stage: 'Festzelt' },
  ],
  lineupNote:
    'Das musikalische Rahmenprogramm wird jeweils zwei Wochen vor der Dult auf der Website der Stadt Salzburg veröffentlicht.',
  intro:
    'Die Salzburger Dult ist das echte, unverfälschte Volksfest der Mozartstadt — weit entfernt vom touristischen Glanz der Festspiele, aber tief verwurzelt in der Salzburger Seele. Zweimal im Jahr, im Frühling und im Herbst, baut sich auf dem Volksgartenparkplatz eine kleine Welt auf: Fahrgeschäfte für Klein und Groß, Marktstände mit regionalen Produkten, Festzelte mit Blasmusik und die Menscheln der ganzen Stadt. Hier trifft der Salzburger Student die Stadtrandsiedlerin, die Touristenfamilie den pensionierten Alteingesessenen — die Dult ist Salzburg, wie es wirklich ist.',
  historyTitle: 'Jahrhunderte Volksfesttradition in Salzburg',
  history:
    'Die Ursprünge der Salzburger Dult reichen zurück ins 18. Jahrhundert, als auf öffentlichen Plätzen in der Nähe des Doms und der Stadtpfarrkirche Märkte und Volksvergnügungen abgehalten wurden. Das Wort „Dult" selbst leitet sich vom mittelhochdeutschen „dulte" ab, was Kirchweihfest bedeutet. Über die Jahrhunderte wanderte der Veranstaltungsort und vergrößerte sich das Angebot. Heute ist die Dult ein fest verankerter Bestandteil des Salzburger Jahreskalenders und ein Treffpunkt für alle Bevölkerungsschichten, der trotz modernen Fahrgeschäften seinen volkskulturellen Charakter bewahrt hat.',
  whatToExpectTitle: 'Was die Salzburger Dult 2026 bietet',
  whatToExpect:
    'Die Dult verbindet traditionellen Volksfestcharme mit modernen Attraktionen. Für Kinder gibt es Karussells, Riesenrad und Schießbuden; Erwachsene genießen deftige Salzburger Küche in den Festzelten, Live-Blasmusik und das bunte Treiben der Marktbuden. Ein besonderer Anziehungspunkt ist der Flohmarkt-Bereich mit Antiquitäten und Secondhand-Waren.',
  whatToExpectList: [
    'Fahrgeschäfte und Attraktionen für alle Altersgruppen',
    'Festzelte mit Live-Blasmusik und regionaler Küche',
    'Marktstände: Handwerk, Lebensmittel, Souvenirs',
    'Flohmarkt mit Antiquitäten und Secondhand',
    'Traditionelle Salzburger Spezialitäten: Brathendl, Stiegl-Bier, Lebkuchenherzen',
    'Familienprogramm mit Kindertagen und vergünstigten Fahrpreisen',
  ],
  practicalInfoTitle: 'Alles Wichtige zur Salzburger Dult',
  practicalInfo: [
    {
      icon: '🎡',
      label: 'Eintritt',
      text: 'Der Eintritt auf das Festgelände ist kostenlos. Für Fahrgeschäfte und Verpflegung Bargeld oder EC-Karte empfohlen.',
    },
    {
      icon: '🚌',
      label: 'Anreise',
      text: 'Bus Linie 1 oder 2 bis Haltestelle Volksgarten/Mozartsteg. Pkw-Parkplätze sind begrenzt — öffentliche Verkehrsmittel empfohlen.',
    },
    {
      icon: '👨‍👩‍👧',
      label: 'Familien',
      text: 'An speziellen Familientagen (meist Dienstag und Mittwoch) gelten vergünstigte Tarife für viele Fahrgeschäfte.',
    },
    {
      icon: '📅',
      label: 'Dauer',
      text: 'Die Frühjahrs-Dult dauert ca. 10 Tage, die Herbst-Dult ca. 14 Tage. Täglich ab 14 Uhr geöffnet, Wochenende ab 10 Uhr.',
    },
  ],
  gallery: [
    {
      src: '/images/blog/salzburger-dult/gallery-1.jpg',
      alt: 'Bunte Fahrgeschäfte auf einem Volksfest',
      caption: 'Volksfestfreude im Salzburger Volksgarten',
    },
    {
      src: '/images/blog/salzburger-dult/gallery-2.jpg',
      alt: 'Festzelt mit Blasmusik und Besuchern',
      caption: 'Blasmusik und Gemütlichkeit im Festzelt',
    },
    {
      src: '/images/blog/salzburger-dult/gallery-3.jpg',
      alt: 'Leuchtende Fahrgeschäfte bei Nacht',
      caption: 'Wenn die Dult abends erstrahlt',
    },
  ],
  ctaText: 'Volkskultur-Events in Salzburg entdecken',
  ctaLink: '/map?bundesland=Salzburg&category=Kultur',
  seoTitle: 'Salzburger Dult 2026 – Volksfest Termine & Tipps',
  seoDescription:
    'Salzburger Dult 2026: Frühlings- und Herbst-Volksfest im Volksgarten. Fahrgeschäfte, Festzelte, Blasmusik und regionale Kulinarik für die ganze Familie.',
  keywords: [
    'Salzburger Dult 2026',
    'Volksfest Salzburg',
    'Dult Salzburg Frühling',
    'Dult Salzburg Herbst',
    'Salzburg Kirmes',
    'Volksgarten Salzburg Fest',
    'Salzburg Familienveranstaltung',
    'Salzburger Volksfest Termine',
    'Dult Fahrgeschäfte Salzburg',
    'Blasmusik Salzburg Fest',
  ],
  jsonLdEvent: {
    name: 'Salzburger Dult 2026',
    startDate: '2026-05-01',
    endDate: '2026-05-14',
    location: 'Volksgartenparkplatz, 5020 Salzburg, Austria',
    addressCountry: 'AT',
    url: 'https://www.salzburg.gv.at',
    description:
      'Die Salzburger Dult ist ein traditionelles Volksfest, das zweimal jährlich (Frühling und Herbst) im Volksgarten in Salzburg stattfindet.',
    image:
      'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=1600&q=85&auto=format&fit=crop',
  },
};
