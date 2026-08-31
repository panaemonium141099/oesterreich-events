import type { FestivalPost } from '../types';

/**
 * fn-21: Erster Artikel der Rubrik "Übernachten" — kuratierte besondere
 * Unterkünfte im Burgenland. Kein Event → kein jsonLdEvent (Event-Schema
 * entfällt bewusst); die stays-Liste rendert Booking-Affiliate-Links.
 */
export const post: FestivalPost = {
  slug: 'besondere-unterkuenfte-burgenland',
  title: 'Schlafen im Weinfass & Safari-Lodge: besondere Unterkünfte im Burgenland',
  subtitle: 'Vom Weinfass in Purbach bis zur Lodge am Steppensee — Übernachtungen, die selbst zum Ausflugsziel werden',
  heroImage: '/images/blog/besondere-unterkuenfte-burgenland/hero.jpg',
  publishDate: '2026-08-31',
  updatedDate: '2026-08-31',
  readingTime: 6,
  excerpt:
    'Das Burgenland kann mehr als Zimmer mit Frühstück: In Purbach schläfst du in einem echten Weinfass, in Frauenkirchen wachst du mit Lodge-Blick über die Salzlacken des Seewinkels auf, und im Südburgenland warten Kellerstöckl zwischen den Rebzeilen. Fünf Unterkünfte, die den Event-Trip zum Kurzurlaub machen.',
  category: 'Übernachten',
  categoryColor: 'bg-emerald-700 text-white',
  keyFacts: {
    dates: 'Ganzjährig — beliebte Termine früh buchen',
    location: 'Burgenland (Neusiedler See bis Südburgenland)',
    address: 'Burgenland, Österreich',
    genre: 'Besondere Unterkünfte',
    price: 'je nach Unterkunft und Saison',
    website: 'https://www.burgenland.info',
  },
  lineup: [],
  intro:
    'Wer im Burgenland ein Festival, ein Konzert bei den Schloss-Spielen oder einen Heurigenabend plant, übernachtet meist zweckmäßig — dabei liegt zwischen Neusiedler See und Südburgenland eine der ungewöhnlichsten Unterkunfts-Landschaften Österreichs. Hier schläfst du in ausgebauten Weinfässern mitten am Hang, in einer Lodge, die sich wie eine afrikanische Safari-Station an den Nationalpark schmiegt, oder in einem jahrhundertealten Kellerstöckl zwischen den Rebzeilen. Wir haben fünf Unterkünfte gesammelt, bei denen die Übernachtung selbst Teil des Erlebnisses ist.',
  historyTitle: 'Warum das Burgenland so besonders übernachtet',
  history:
    'Die ungewöhnlichen Quartiere des Burgenlands sind kein Marketing-Einfall, sondern gewachsene Kultur: Die Weinfässer und Kellerstöckl stammen direkt aus der Weinbau-Tradition des Landes — viele Kellerstöckl im Südburgenland sind über hundert Jahre alte Presshäuser, die behutsam zu Ferienquartieren umgebaut wurden. Und rund um den Neusiedler See prägt der Nationalpark Neusiedler See–Seewinkel mit seinen Salzlacken und Vogelkolonien die Architektur der neuen Lodges: flach, naturnah, mit Blick ins Schilf statt auf Parkplätze. UNESCO-Welterbe-Landschaft inklusive.',
  whatToExpectTitle: 'Diese fünf Unterkünfte lohnen den Umweg',
  whatToExpect:
    'Von puristisch bis luxuriös — die Auswahl deckt verschiedene Budgets ab. Gemeinsam haben alle fünf: Sie liegen maximal eine Stunde von den großen Event-Hotspots des Landes entfernt (Nova Rock in Nickelsdorf, Schloss Esterházy und die Seefestspiele Mörbisch), und sie sind selbst einen Aufenthalt wert.',
  whatToExpectList: [
    'Schlafen im Weinfass in Purbach: umgebaute Original-Weinfässer direkt am Weinberg — kompakt, kultig, im Sommer schnell ausgebucht',
    'St. Martins Therme & Lodge in Frauenkirchen: Safari-Feeling am Rand des Nationalparks, mit eigenem Badesee und Therme',
    'Vila Vita Pannonia in Pamhagen: weitläufiges Feriendorf im Seewinkel mit Bungalows zwischen Teichen und Wiesen',
    'Kellerstöckl am Eisenberg: übernachten im historischen Presshaus mitten im Weinberg des Südburgenlands',
    'Hotel Galántha in Eisenstadt: Design-Hotel direkt beim Schloss Esterházy — ideal für Konzert- und Festspielbesuche',
  ],
  practicalInfoTitle: 'Gut zu wissen',
  practicalInfo: [
    { icon: 'wann', label: 'Beste Zeit', text: 'Mai bis Oktober für Weinfass & Kellerstöckl (unbeheizt bzw. saisonal), ganzjährig für Lodge, Feriendorf und Stadthotel. Rund um Nova Rock (Juni) und die Seefestspiele (Juli/August) früh reservieren.' },
    { icon: 'auto', label: 'Anreise', text: 'Purbach und Eisenstadt sind ab Wien per Bahn/Bus gut erreichbar; für Seewinkel und Südburgenland ist das eigene Auto die entspannteste Option.' },
    { icon: 'ticket', label: 'Buchen', text: 'Die Verfügbarkeits-Buttons unten führen direkt zur Booking.com-Suche der jeweiligen Unterkunft — Stadt und Name sind vorausgefüllt.' },
  ],
  gallery: [],
  ctaText: 'Events im Burgenland entdecken',
  ctaLink: '/burgenland',
  seoTitle: 'Besondere Unterkünfte im Burgenland: Weinfass, Lodge & Kellerstöckl (2026)',
  seoDescription:
    'Schlafen im Weinfass in Purbach, Safari-Lodge am Neusiedler See, Kellerstöckl im Südburgenland: 5 besondere Unterkünfte im Burgenland für deinen nächsten Event-Trip — mit Buchungslinks.',
  keywords: [
    'besondere unterkünfte burgenland',
    'schlafen im weinfass purbach',
    'übernachten neusiedler see',
    'kellerstöckl südburgenland',
    'st martins therme lodge',
    'außergewöhnlich übernachten österreich',
  ],
  faqs: [
    {
      question: 'Wo kann man im Burgenland im Weinfass schlafen?',
      answer:
        'In Purbach am Neusiedler See gibt es ausgebaute Original-Weinfässer als Schlafplätze direkt am Weinberg. Die Fässer sind kompakt eingerichtet und vor allem von Frühling bis Herbst buchbar — für die Sommermonate empfiehlt sich eine frühe Reservierung.',
    },
    {
      question: 'Welche Unterkunft passt zu einem Nova-Rock-Besuch?',
      answer:
        'Nickelsdorf liegt im Seewinkel-Eck des Burgenlands: Die Vila Vita Pannonia in Pamhagen und die St. Martins Therme & Lodge in Frauenkirchen sind jeweils rund 20 bis 30 Autominuten vom Festivalgelände entfernt — deutlich komfortabler als der Zeltplatz.',
    },
    {
      question: 'Was ist ein Kellerstöckl?',
      answer:
        'Kellerstöckl sind die historischen Presshäuser der südburgenländischen Weinberge, oft über hundert Jahre alt. Viele wurden zu kleinen Ferienhäusern für zwei bis vier Personen umgebaut und stehen mitten in den Rebzeilen — etwa am Eisenberg oder in Deutsch Schützen.',
    },
  ],
  stays: [
    {
      name: 'Schlafen im Weinfass',
      place: 'Purbach am Neusiedler See',
      region: 'Nordburgenland',
      kind: 'Weinfass',
      description:
        'Ausgebaute Original-Weinfässer am Purbacher Weinberg — jedes Fass mit Schlafplatz für zwei. Puristisch, kultig und näher am Wein geht es nicht: Der nächste Heurige liegt ein paar Gehminuten entfernt in der historischen Kellergasse.',
    },
    {
      name: 'St. Martins Therme & Lodge',
      place: 'Frauenkirchen',
      region: 'Seewinkel',
      kind: 'Therme + Lodge',
      description:
        'Safari-Atmosphäre am Rand des Nationalparks Neusiedler See–Seewinkel: eigene Badeseen, Thermenlandschaft und geführte Ranger-Touren in die Salzlacken. Ideal als komfortable Basis für Nova Rock oder einen Seewinkel-Wochenendtrip.',
    },
    {
      name: 'Vila Vita Pannonia',
      place: 'Pamhagen',
      region: 'Seewinkel',
      kind: 'Feriendorf',
      description:
        'Weitläufiges Resort-Dorf mit Bungalows und Suiten zwischen Teichen, Wiesen und Wäldchen — viel Platz für Gruppen, die gemeinsam zu einem Festival oder Fest im Seewinkel anreisen.',
    },
    {
      name: 'Kellerstöckl',
      place: 'Eisenberg an der Pinka',
      region: 'Südburgenland',
      kind: 'Presshaus im Weinberg',
      description:
        'Am Eisenberg und in den umliegenden Weinbergen des Südburgenlands sind zahlreiche historische Kellerstöckl zu Ferienhäusern geworden: dicke Mauern, Blick über die Rebzeilen, absolute Ruhe — perfekt nach einem Tag zwischen Uhudler-Verkostung und Dorffest.',
    },
    {
      name: 'Hotel Galántha',
      place: 'Eisenstadt',
      region: 'Nordburgenland',
      kind: 'Design-Hotel',
      description:
        'Modernes Design-Hotel wenige Schritte vom Schloss Esterházy — die naheliegendste Adresse für Besuche der Schlosskonzerte, des Herbstgold-Festivals oder eines Stadt-Wochenendes in der Landeshauptstadt.',
    },
  ],
};
