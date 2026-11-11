import type { FestivalPost } from '../types';

// Termine 2026 bis 2028, Programm 2026, Preise, Ort und Anreise geprüft am 2026-10-27 gegen
// weinviertel.at/retzer-land/retzer-weinlesefest (Weinviertel Tourismus, Ziel der alten URL
// retzer-land.at/weinlesefest). Termin 24. bis 27.09.2026 und Preise stimmten. Vorher falsch:
// "seit 1930" (2026 war die 71. Auflage, "seit 70 Jahren"), "ältestes Weinfest Niederösterreichs"
// ohne Beleg, "Krönung der Weinlesekönigsfamilie" (es gibt die Weinbrunnen-Eröffnung mit der
// NÖ Weinkönigin), "burgenländische Blasmusik", Kelleröffnung und Gerichte ohne Beleg,
// 30.000 Besucher ohne Beleg, Anreise über S5/B30. Jetzt auf die Ausgabe 2027 umgestellt.
export const post: FestivalPost = {
  slug: 'retz-weinlesefest',
  title: 'Retzer Weinlesefest 2027',
  subtitle: 'Das Bezirksweinlesefest feiert die Ernte auf dem historischen Hauptplatz von Retz',
  heroImage: '/images/blog/retz-weinlesefest/hero.jpg',
  thumbnailImage: '/images/blog/retz-weinlesefest/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.weinviertel.at/retzer-land/retzer-weinlesefest',
    ],
  },
  readingTime: 5,
  excerpt:
    'Am letzten Septemberwochenende wird der Hauptplatz von Retz zum Festgelände: Hauermarkt, Großheuriger, zwei Weinbrunnen, Festumzug und Feuerwerk. Die 72. Ausgabe des Retzer Weinlesefests läuft vom 23. bis 26. September 2027.',
  category: 'Kulinarik & Tradition',
  categoryColor: 'bg-purple-800 text-white',
  keyFacts: {
    dates: '23. bis 26. September 2027 (2026: 24. bis 27. September)',
    location: 'Retz Hauptplatz, Niederösterreich',
    address: 'Hauptplatz, 2070 Retz',
    genre: 'Weinfest, Volksmusik, Kulinarik, Brauchtum',
    price: 'Festabzeichen 2026: Vorverkauf ab € 9, Tageskasse ab € 10, Kinder bis 14 frei',
    website: 'https://www.weinviertel.at/retzer-land/retzer-weinlesefest',
  },
  lineup: [
    { name: 'Desperate Brasswives', role: 'headliner', day: 'Freitag', time: '22:00' },
    { name: 'Die Beislkosmonauten', role: 'headliner', day: 'Samstag', time: '22:00' },
    { name: 'Die Saubartln', role: 'headliner', day: 'Sonntag', time: '17:30' },
    { name: 'Weinbrunnen-Eröffnung mit der NÖ Weinkönigin', role: 'special', day: 'Sonntag' },
    { name: 'Festumzug „Weinherbst im Weinviertel“', role: 'special', day: 'Sonntag', time: '14:10' },
    { name: 'Großes Feuerwerk zum Abschluss', role: 'special', day: 'Sonntag', time: '19:30' },
    { name: 'Stadtkapelle Retz', role: 'support', day: 'Sonntag' },
    { name: 'Volkstanzgruppe Rosenburg-Mold', role: 'support', day: 'Sonntag' },
  ],
  lineupTitle: 'Programm-Highlights 2026',
  lineupNote:
    'Auszug aus dem Programm 2026 laut Weinviertel Tourismus. Das Programm 2027 ist noch nicht veröffentlicht.',
  intro:
    'Retz, die beschauliche Stadtgemeinde im Weinviertel nahe der tschechischen Grenze, verwandelt sich jedes Jahr am letzten Septemberwochenende in ein großes Weinfest. Das Retzer Weinlesefest, offiziell Bezirksweinlesefest, fand 2026 zum 71. Mal statt und zieht Einheimische, Weinliebhaber und Ausflügler auf den Hauptplatz. Hauermarkt, Großheuriger, Blasmusik und die Gassen der Altstadt verbinden sich zu einem herbstlichen Erlebnis mit tiefen Wurzeln in der Region.',
  historyTitle: 'Seit rund 70 Jahren: Die Weinlese als Fest',
  history:
    'Das Retzer Weinlesefest gibt es laut Weinviertel Tourismus seit 70 Jahren, 2026 lief die 71. Ausgabe. Eröffnet wird es traditionell mit dem Aufstecken des Heurigen-Buschs auf dem Hauptplatz und dem Ausschank des jungen Weins. Am Samstag schenkt Weingott Bacchus aus den Weinbrunnen den Retzer Stadtwein aus, am Sonntag eröffnet die niederösterreichische Weinkönigin die Weinbrunnen, bevor der Festumzug durch die Innenstadt zieht. Retz selbst ist für seine Weinkeller unter der Altstadt, die Windmühle und den historischen Hauptplatz bekannt.',
  whatToExpectTitle: 'Wein, Musik und Weinviertel-Atmosphäre',
  whatToExpect:
    'Das Weinlesefest füllt den Hauptplatz an vier Tagen mit Leben: Hauermarkt und Großheuriger öffnen am Nachmittag, auf der Festbühne spielen Blasmusik, Volksmusik und Partybands, in der Wallstraße steht ein Vergnügungspark. Der Samstag bringt einen Familiennachmittag, der Sonntag Festmesse, Frühschoppen, Weinbrunnen-Eröffnung und Festumzug. Zum Schluss gibt es ein großes Feuerwerk.',
  whatToExpectList: [
    'Hauermarkt und Großheuriger auf dem Hauptplatz',
    'Zwei Weinbrunnen, aus denen statt Wasser Wein fließt',
    'Blasmusik, Volkstanz und Partybands auf der Festbühne',
    'Festumzug am Sonntag und großes Abschlussfeuerwerk',
    'Vergnügungspark in der Wallstraße',
    'Kinder bis einschließlich 14 Jahre haben freien Eintritt',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🚂',
      label: 'Anreise mit der Bahn',
      text: 'Weinviertel Tourismus empfiehlt die Öffis: Retz hat direkte Zugverbindungen aus Wien.',
    },
    {
      icon: '🚗',
      label: 'Anreise mit dem Auto',
      text: 'Über die A22 und die S3. Reisebusse parken bei der Firma Schaden, Sandweg 8.',
    },
    {
      icon: '🎟️',
      label: 'Festabzeichen',
      text: 'Preise 2026 im Online-Vorverkauf: Donnerstag und Freitag € 9, Samstag € 12, Sonntag € 11, 4-Tages-Pass € 20. Vorverkauf auch in der Gästeinfo Retzer Land, Hauptplatz 30.',
    },
    {
      icon: '🏰',
      label: 'Stadtbesichtigung',
      text: 'Retz ist auch ohne Fest sehenswert: Windmühle, historischer Hauptplatz und mittelalterliche Stadtmauer.',
    },
  ],
  gallery: [],
  ctaText: 'Weinfeste in Niederösterreich entdecken',
  ctaLink: '/map?bundesland=Nieder%C3%B6sterreich&category=Kulinarik',
  seoTitle: 'Retzer Weinlesefest 2027: Termin, Programm und Preise',
  seoDescription:
    'Retzer Weinlesefest 2027 vom 23. bis 26. September: Hauermarkt, Weinbrunnen, Festumzug und Feuerwerk am Hauptplatz Retz. Termine, Preise und Anreise.',
  keywords: [
    'Retz Weinlesefest',
    'Retzer Weinlesefest',
    'Weinlesefest Retz 2027',
    'Weinlesefest Retz 2026',
    'Weinfest Niederösterreich',
    'Weinviertel Festival',
    'Volksmusik Niederösterreich',
    'Brauchtum Weinviertel',
    'Weinernte Fest Österreich',
    'Herbstfest Niederösterreich',
  ],
  jsonLdEvent: {
    name: 'Retzer Weinlesefest 2027',
    startDate: '2027-09-23',
    endDate: '2027-09-26',
    location: 'Hauptplatz Retz, 2070 Retz, Austria',
    addressCountry: 'AT',
    url: 'https://www.weinviertel.at/retzer-land/retzer-weinlesefest',
    description:
      'Das 72. Retzer Weinlesefest findet vom 23. bis 26. September 2027 auf dem Hauptplatz von Retz im Weinviertel statt.',
    image:
      'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1600&q=85&auto=format&fit=crop',
  },
};
