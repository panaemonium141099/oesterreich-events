import type { FestivalPost } from '../types';

export const post: FestivalPost = {
  slug: 'viennale',
  title: 'Viennale',
  subtitle: 'Wiens Internationales Filmfestival – Kino als Ereignis im Oktober',
  heroImage:
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1600&q=85&auto=format&fit=crop',
  thumbnailImage:
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80&auto=format&fit=crop',
  publishDate: '2026-03-31',
  updatedDate: '2026-03-31',
  readingTime: 6,
  excerpt:
    'Die Viennale ist Österreichs bedeutendstes Filmfestival. Zwei Wochen lang zeigt Wien das Beste des internationalen Kinos – Premieren, Retrospektiven und Begegnungen mit Filmemachern.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-slate-700 text-white',
  keyFacts: {
    dates: 'Oktober (zwei Wochen)',
    location: 'Diverse Wiener Kinos (Gartenbaukino, Metro Kinokulturhaus, Stadtkino, Filmmuseum u.a.)',
    address: 'Gartenbaukino: Parkring 12, 1010 Wien (Hauptspielstätte)',
    genre: 'Arthouse Kino, Dokumentarfilm, Retrospektive, Weltpremieren',
    price: 'Tickets ab ca. € 12 | Festival-Pass erhältlich',
    website: 'https://www.viennale.at',
    capacity: 'ca. 100.000 Besucher pro Ausgabe',
    since: '1960',
  },
  lineup: [
    { name: 'Internationaler Wettbewerb', role: 'headliner', stage: 'Gartenbaukino' },
    { name: 'Österreich-Programm', role: 'special', stage: 'Metro Kinokulturhaus' },
    { name: 'Retrospektive (wechselndes Thema)', role: 'special', stage: 'Filmmuseum' },
    { name: 'Dokumentarfilme', role: 'support', stage: 'Stadtkino' },
    { name: 'Q&A mit Filmemachern', role: 'special', stage: 'Gartenbaukino & Metro' },
  ],
  lineupNote: 'Das Viennale-Programm wird traditionell Anfang Oktober bekanntgegeben.',
  intro:
    'Jeden Oktober öffnet die Viennale ihre Türen und macht Wien für zwei Wochen zur Filmhauptstadt Europas. Das internationale Filmfestival präsentiert seit 1960 das Beste des zeitgenössischen und historischen Kinos: Weltpremieren ambitionierter Autorenfilme, kuratierte Retrospektiven, österreichische Produktionen und Dokumentarfilme, die anderswo nie ins Kino kämen. Die Viennale ist kein Glamour-Festival im Hollywood-Sinne – sie ist cinephiles Kino pur, ein Ort der Begegnung zwischen Filmemachern und einem außergewöhnlich cinephilen Publikum.',
  historyTitle: 'Seit 1960 – Kontinuität und Neugier',
  history:
    'Die Viennale wurde 1960 als kleines Filmfestival gegründet und entwickelte sich im Laufe der Jahrzehnte zu einem der angesehensten Filmfestivals Europas. Unter legendären Leitern wie Hans Hurch (1997–2017) und seiner Nachfolgerin Eva Sangiorgi (ab 2018) wurde das Festival für seine kompromisslosen Programmentscheidungen bekannt: Qualität vor Quantität, cinephile Tiefe statt Blockbuster. Die enge Zusammenarbeit mit dem Österreichischen Filmmuseum macht die Retrospektiven zu einem eigenen Programm-Höhepunkt.',
  whatToExpectTitle: 'Was erwartet dich bei der Viennale?',
  whatToExpect:
    'Das Programm umfasst rund 200 Filme aus aller Welt in zwei Wochen: internationale Spielfilme, Dokumentarfilme, Kurzfilme und historische Retrospektiven. Viele Filmemacher sind persönlich anwesend und stehen nach den Vorführungen für Publikumsgespräche zur Verfügung. Das Gartenbaukino mit seinem historischen Saal ist die atmosphärischste Hauptspielstätte.',
  whatToExpectList: [
    'Rund 200 Filme in 2 Wochen – internationales Programm',
    'Weltpremieren und österreichische Produktionen',
    'Retrospektive mit thematischem Schwerpunkt im Filmmuseum',
    'Q&A-Sessions mit internationalen Filmemachern',
    'Festival-Pass für Viel-Seher erhältlich',
    'Atmosphärische Spielstätten: Gartenbaukino, Metro, Stadtkino, Filmmuseum',
  ],
  practicalInfoTitle: 'Praktische Infos zur Viennale',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets & Pass',
      text: 'Tickets ab Oktober im Vorverkauf. Festival-Pass lohnt sich ab 6+ Filmen. Karten online oder an der Kinokasse.',
    },
    {
      icon: '🚇',
      label: 'Anreise Gartenbaukino',
      text: 'U3 Stubentor oder U4 Stadtpark, dann 5 Minuten zu Fuß. Straßenbahn 2 (Weihburggasse).',
    },
    {
      icon: '📽️',
      label: 'Programm-Tipp',
      text: 'Programm erscheint Anfang Oktober. Früh planen – begehrte Vorführungen mit Gästen sind oft schnell ausverkauft.',
    },
    {
      icon: '🍿',
      label: 'Kinogenuss',
      text: 'Das Gartenbaukino hat eine hauseigene Bar. Nachgespräche und Zufallsbegegnungen gehören zum Festival-Erlebnis.',
    },
  ],
  gallery: [
    {
      src: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80&auto=format&fit=crop',
      alt: 'Historisches Kinogebäude von außen bei Nacht',
      caption: 'Das Gartenbaukino – Wiens schönste Filmspielstätte',
    },
    {
      src: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80&auto=format&fit=crop',
      alt: 'Filmvorführung in einem vollen Kinosaal',
      caption: 'Cinephiles Publikum bei der Viennale',
    },
    {
      src: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80&auto=format&fit=crop',
      alt: 'Filmrolle und Kino-Ausrüstung als Symbol',
      caption: 'Zwei Wochen internationales Kino in Wien',
    },
  ],
  ctaText: 'Film- und Kultur-Events in Wien entdecken',
  ctaLink: '/map?category=Kultur&region=Wien',
  seoTitle: 'Viennale 2026 – Wiener Internationales Filmfestival Oktober',
  seoDescription:
    'Die Viennale 2026: Österreichs wichtigstes Filmfestival mit 200 Filmen, Weltpremieren und Filmgesprächen in Wien im Oktober. Tickets und Programm.',
  keywords: [
    'Viennale',
    'Wien Filmfestival',
    'Viennale 2026',
    'Internationales Filmfestival Wien',
    'Gartenbaukino',
    'Wien Kino Festival',
    'Viennale Tickets',
    'Filmfestival Oktober Wien',
    'Vienna International Film Festival',
    'Arthouse Kino Wien',
  ],
  jsonLdEvent: {
    name: 'Viennale 2026 – Wiener Internationales Filmfestival',
    startDate: '2026-10-15',
    endDate: '2026-10-28',
    location: 'Parkring 12, 1010 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://www.viennale.at',
    description:
      'Die Viennale ist Österreichs bedeutendstes Filmfestival mit über 200 internationalen Filmen, Weltpremieren und Retrospektiven.',
    image:
      'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1600&q=85&auto=format&fit=crop',
  },
};
