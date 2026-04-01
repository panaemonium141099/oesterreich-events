import type { FestivalPost } from '../types';

export const post: FestivalPost = {
  slug: 'ironman-austria-klagenfurt',
  title: 'IRONMAN Austria Klagenfurt',
  subtitle: 'Einer der schönsten Triathlons der Welt – 3,8 km Schwimmen, 180 km Radfahren, 42,2 km Laufen',
  heroImage:
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&q=85&auto=format&fit=crop',
  thumbnailImage:
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80&auto=format&fit=crop',
  publishDate: '2026-04-01',
  updatedDate: '2026-04-01',
  readingTime: 7,
  excerpt:
    'Der IRONMAN Austria in Klagenfurt zählt zu den beliebtesten und schönsten Langdistanz-Triathlons der Welt. Der Startschuss fällt im kristallklaren Wörthersee – das Ziel liegt im Herz der Klagenfurter Innenstadt.',
  category: 'Sport & Outdoor',
  categoryColor: 'bg-blue-700 text-white',
  keyFacts: {
    dates: '14. Juni 2026',
    location: 'Strandbad Klagenfurt & Klagenfurter Innenstadt',
    address: 'Strandbad Klagenfurt, Metnitzstrand, 9020 Klagenfurt',
    genre: 'Triathlon, Ausdauersport, Langdistanz',
    price: 'Startergebühr ca. 600 € (Athleten); Zuschauen kostenlos',
    website: 'https://www.ironman.com/im-austria',
    capacity: 'ca. 2.500 Athleten, 100.000 Zuschauerinnen und Zuschauer',
    since: '1998',
  },
  lineup: [
    { name: 'Elite-Men Start', role: 'headliner', day: '14. Juni', time: '07:00 Uhr', stage: 'Wörthersee-Start' },
    { name: 'Elite-Women Start', role: 'headliner', day: '14. Juni', time: '07:05 Uhr', stage: 'Wörthersee-Start' },
    { name: 'Age Group Wellen-Start', role: 'support', day: '14. Juni', time: 'ab 07:20 Uhr', stage: 'Wörthersee-Start' },
    { name: 'Zieldurchlauf & Siegerehrung', role: 'special', day: '14. Juni', time: 'ab 15:00 Uhr', stage: 'Klagenfurter Innenstadt' },
  ],
  lineupNote:
    'Die genauen Startwellen und das vollständige Athletenprogramm werden nach Anmeldeschluss auf der offiziellen IRONMAN-Website veröffentlicht.',
  intro:
    'Kein Triathlon der Welt beginnt in einer schöneren Kulisse: Der IRONMAN Austria Klagenfurt startet im kristallklaren Wörthersee, führt auf dem Rad durch die malerische Kärntner Seenlandschaft und endet in der Klagenfurter Innenstadt – begleitet von Tausenden begeisterten Zuschauerinnen und Zuschauern, die jede Meile des Kurses säumen. Seit 1998 ist Klagenfurt die europäische Heimat des Langdistanz-Triathlons und einer der Austragungsorte, bei denen Athletinnen und Athleten aus aller Welt ihre Grenzen überwinden.',
  historyTitle: 'Klagenfurt und IRONMAN: Eine Liebesgeschichte seit 1998',
  history:
    'Als Klagenfurt 1998 zum ersten Mal Gastgeber des IRONMAN Austria wurde, war die Idee mutig: Einen der anspruchsvollsten Ausdauerwettkämpfe der Welt in einer mitteleuropäischen Mittelstadt auszutragen. Doch die Begeisterung der Kärntnerinnen und Kärntner für das Event und die traumhafte Landschaft überzeugten schnell – heute gilt der IRONMAN Austria als einer der qualitätsvollsten und stimmungsvollsten Triathlons weltweit. Klagenfurt hat die Veranstaltung über die Jahre professionalisiert und die Infrastruktur konsequent ausgebaut.',
  whatToExpectTitle: 'Was Athleten und Zuschauer erwartet',
  whatToExpect:
    'Der IRONMAN Austria ist nicht nur ein Wettkampf für Athletinnen und Athleten – er ist ein Volksfest. Entlang der gesamten Rennstrecke verwandeln sich Orte und Straßen in Freiluft-Tribünen, und an der Zielgerade in der Klagenfurter Innenstadt ist die Stimmung am Abend atemberaubend. Für Familien und Zuschauergruppen gibt es spezielle Zuschauermeilen mit Verpflegung und Programmblöcken.',
  whatToExpectList: [
    'Schwimmstart im Wörthersee – mit Hubschrauber-Drohnenaufnahmen live übertragen',
    'Radstrecke durch die Kärntner Seenlandschaft (Faaker See, Weißensee)',
    'Laufstrecke durch die Klagenfurter Innenstadt',
    'Zieldurchlauf in der illuminierten Innenstadt – bewegende Finisher-Momente',
    'Expo und Athlete-Village mit Ausrüstungspartnern und Foodstalls',
    'Rahmenprogramm mit Siegerehrung und After-Race-Party',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🏅',
      label: 'Anmeldung',
      text: 'Athleten melden sich auf ironman.com an. Die Startplätze sind begrenzt und meist innerhalb weniger Stunden ausgebucht.',
    },
    {
      icon: '👀',
      label: 'Zuschauen',
      text: 'Das Zuschauen ist kostenlos. Beste Spots: Wörthersee-Start, Radstrecke bei Pörtschach, Zielgerade Innenstadt.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Klagenfurt HBF ist 5 km vom Strandbad entfernt. Busse und Shuttle-Services am Renntag sind eingerichtet.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Hotels in Klagenfurt und am Wörthersee sind für das IRONMAN-Wochenende früh ausgebucht – 6–12 Monate im Voraus planen.',
    },
  ],
  gallery: [
    {
      src: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80&auto=format&fit=crop',
      alt: 'Triathleten schwimmen in einem See',
      caption: 'Massenstart im Wörthersee – der IRONMAN beginnt',
    },
    {
      src: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80&auto=format&fit=crop',
      alt: 'Radsport in Berglandschaft',
      caption: 'Radstrecke durch die Kärntner Seenlandschaft',
    },
    {
      src: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80&auto=format&fit=crop',
      alt: 'Läufer im Zieleinlauf mit jubelndem Publikum',
      caption: 'Der Zieldurchlauf – ein unvergesslicher Moment für jeden Finisher',
    },
  ],
  ctaText: 'Sport-Events in Kärnten entdecken',
  ctaLink: '/map?bundesland=Kärnten&category=Sport',
  seoTitle: 'IRONMAN Austria Klagenfurt 2026 – Anmeldung & Infos',
  seoDescription:
    'IRONMAN Austria Klagenfurt 2026 (5. Juli): Langdistanz-Triathlon im Wörthersee. Startinfo für Athleten und Tipps für Zuschauerinnen und Zuschauer.',
  keywords: [
    'IRONMAN Austria 2026',
    'Triathlon Klagenfurt',
    'IRONMAN Klagenfurt',
    'Langdistanz Triathlon Österreich',
    'Wörthersee Triathlon',
    'IRONMAN Austria Anmeldung',
    'Triathlon Kärnten',
    'Klagenfurt Sport Event',
    'IRONMAN Austria Zuschauer',
    'Ausdauersport Kärnten',
  ],
  jsonLdEvent: {
    name: 'IRONMAN Austria Klagenfurt 2026',
    startDate: '2026-06-14',
    endDate: '2026-06-14',
    location: 'Strandbad Klagenfurt, Metnitzstrand, 9020 Klagenfurt am Wörthersee, Austria',
    addressCountry: 'AT',
    url: 'https://www.ironman.com/im-austria',
    description:
      'Der IRONMAN Austria Klagenfurt ist einer der beliebtesten Langdistanz-Triathlons der Welt mit Start im Wörthersee und Ziel in der Klagenfurter Innenstadt.',
    image:
      'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&q=85&auto=format&fit=crop',
  },
};
