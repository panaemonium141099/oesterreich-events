import type { FestivalPost } from '../types';

// Rhythmus, Geschichte, Spielzeit 2026, Programm, Leitung und Kontakt geprüft am
// 2026-10-27 gegen volksschauspiele.at (Startseite, /kontakt), die Medieninformation
// vom 04.07.2026 (service.volksschauspiele.at/download/?ids=3164), falter.at/festival/
// 24870/tiroler-volksschauspiele-telfs-2026 (Zeitraum 4.7. bis 29.8.2026),
// meinbezirk.at (Premiere Feuernacht) und de.wikipedia.org/wiki/Tiroler_Volksschauspiele
// (Gründung 1981, Wechsel nach Telfs 1982; bestätigt im Browser durch innsbruck.info/blog/
// de/kunst-kultur/sommer-theater-festival-die-tiroler-volksschauspiele/, Gründer wie im Text). Der
// Post war im Kern falsch: Die Volksschauspiele finden jährlich statt, nicht „alle vier
// Jahre“; gegründet 1981 in Hall (nicht 1924 mit einem Passionsspiel); Profis und Laien
// spielen gemeinsam an wechselnden Spielorten, eine „Freilichtbühne Telfs, Gießenweg 12“
// mit 2.000 Plätzen, „Ortenberg“, Preise und „Telfs HBF“ waren erfunden. Termin 2027 ist
// noch nicht veröffentlicht (Programm-Pressekonferenz laut Website t.b.a.).
export const post: FestivalPost = {
  slug: 'tiroler-volksschauspiele-telfs',
  title: 'Tiroler Volksschauspiele Telfs',
  subtitle: 'Theatersommer in Telfs: Volkstheater mit Profis und Laien an wechselnden Spielorten, jedes Jahr im Juli und August',
  heroImage: '/images/blog/tiroler-volksschauspiele-telfs/hero.jpg',
  thumbnailImage: '/images/blog/tiroler-volksschauspiele-telfs/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 6,
  excerpt:
    'Seit 1982 ist Telfs jeden Sommer Schauplatz der Tiroler Volksschauspiele. 2026 brachte das Festival die Uraufführung von Felix Mitterers „Feuernacht“ in der Südtiroler Siedlung, mit Live-Musik von Herbert Pixner.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-emerald-700 text-white',
  keyFacts: {
    dates: '2026: 4. Juli bis 29. August. Termine 2027 folgen',
    location: 'Telfs, wechselnde Spielorte (2026 u. a. RathausSaal und Südtiroler Siedlung)',
    address: 'Untermarktstraße 5+7, 6410 Telfs',
    genre: 'Volkstheater, Schauspiel, Uraufführungen, Lesungen',
    price: 'je nach Produktion, Kartenanfragen an ticket@volksschauspiele.at',
    website: 'https://www.volksschauspiele.at',
    since: '1981 (in Telfs seit 1982)',
  },
  lineup: [
    { name: 'Feuernacht (Uraufführung, Felix Mitterer)', role: 'headliner', day: 'Premiere 30. Juli 2026', stage: 'Südtiroler Siedlung' },
    { name: 'Herbert Pixner und Band (Live-Musik zu Feuernacht)', role: 'special', stage: 'Südtiroler Siedlung' },
    { name: 'Marathonlesung „Flucht ohne Ende“ (Joseph Roth)', role: 'support', day: '19. Juli 2026', stage: 'Großer Rathaussaal' },
  ],
  lineupTitle: 'Programm-Highlights 2026',
  lineupNote:
    'Feuernacht in einer Bühnenfassung von Peter Lorenz, Regie Thomas Gassner. Das Programm 2027 wird laut Website bei einer Pressekonferenz vorgestellt, Termin noch offen.',
  intro:
    'Die Tiroler Volksschauspiele sind der Theatersommer von Telfs im Oberinntal: Jedes Jahr im Juli und August zeigen sie Volkstheater im besten Sinn, mit Uraufführungen, Lesungen und Stücken, die Geschichte als Frage an die Gegenwart stellen. Eine feste Bühne gibt es nicht; für jede Produktion wird ein passender Ort gesucht, 2026 etwa die Südtiroler Siedlung für Felix Mitterers „Feuernacht“. Auf der Bühne stehen seit Beginn Profis gemeinsam mit Laien. Künstlerischer Leiter ist Gregor Bloéb.',
  historyTitle: 'Seit 1981: Volkstheater mit neuen Impulsen',
  history:
    'Die Tiroler Volksschauspiele wurden 1981 gegründet, auf Initiative von Kurt Weinzierl, gemeinsam mit Dietmar Schönherr, Otto Grünmandl und Josef Kuderna. Die erste Ausgabe fand in Hall in Tirol statt, mit Franz Kranewitters Einaktern „Die sieben Todsünden“. Nach dem Streit um Felix Mitterers Stück „Stigma“ zog sich Hall zurück, und 1982 bot Telfs den Volksschauspielen eine neue Heimat. Seither spielen sie jeden Sommer dort. Seit 2019 trägt eine gemeinnützige GmbH im Eigentum der Marktgemeinde Telfs das Festival.',
  whatToExpectTitle: 'Was die Volksschauspiele Telfs bieten',
  whatToExpect:
    'Die Spielzeit 2026 lief von 4. Juli bis 29. August. Eröffnet wurde sie im RathausSaal, am 19. Juli folgte eine Marathonlesung mit Texten von Joseph Roth in Kooperation mit den Vereinigten Bühnen Bozen. Hauptproduktion war die Uraufführung „Feuernacht“, Felix Mitterers Fortsetzung seines Stücks „Verkaufte Heimat“, mit über 30 Darstellenden in der Südtiroler Siedlung. Laut Bericht waren alle Vorstellungen bereits zur Premiere ausverkauft.',
  whatToExpectList: [
    'Jährlicher Theatersommer im Juli und August',
    'Uraufführungen, etwa von Felix Mitterer',
    'Wechselnde Spielorte in Telfs statt fester Bühne',
    'Profis und Laien gemeinsam auf der Bühne',
    'Lesungen, darunter eine Marathonlesung',
  ],
  practicalInfoTitle: 'Alles Wichtige zu den Volksschauspielen',
  practicalInfo: [
    {
      icon: '🎭',
      label: 'Tickets',
      text: 'Kartenanfragen an ticket@volksschauspiele.at. Die Vorstellungen 2026 von „Feuernacht“ waren schon zur Premiere ausverkauft, früh buchen lohnt sich.',
    },
    {
      icon: '📍',
      label: 'Kontakt',
      text: 'Tiroler Volksschauspiele, Untermarktstraße 5+7, 6410 Telfs; Büro Obermarktstraße 6. Die Spielorte wechseln je nach Produktion.',
    },
    {
      icon: '🧥',
      label: 'Wetter',
      text: 'Sommerliches Tiroler Wetter: 15 bis 28 °C. Leichte Jacke und ggf. Regenjacke für Abendvorstellungen empfohlen.',
    },
    {
      icon: '📅',
      label: 'Spielzeit',
      text: 'Die Volksschauspiele finden jeden Sommer statt. Programm und Termine 2027 sind noch nicht veröffentlicht; aktuelle Infos auf volksschauspiele.at.',
    },
  ],
  gallery: [],
  ctaText: 'Theaterveranstaltungen in Tirol entdecken',
  ctaLink: '/map?bundesland=Tirol&category=Kultur',
  seoTitle: 'Tiroler Volksschauspiele Telfs: Theater & Tradition',
  seoDescription:
    'Tiroler Volksschauspiele Telfs: jeden Sommer Volkstheater mit Profis und Laien an wechselnden Spielorten. Geschichte seit 1981, Programm 2026 und Tickets.',
  keywords: [
    'Tiroler Volksschauspiele Telfs',
    'Volksschauspiele Tirol',
    'Theatersommer Telfs',
    'Volkstheater Tirol',
    'Telfs Theater',
    'Feuernacht Mitterer',
    'Volksschauspiele 2027',
    'Gregor Bloéb Volksschauspiele',
    'Theater Tirol Sommer',
    'Felix Mitterer Uraufführung',
  ],
  jsonLdEvent: {
    name: 'Tiroler Volksschauspiele Telfs 2026',
    startDate: '2026-07-04',
    endDate: '2026-08-29',
    location: 'Untermarktstraße 5+7, 6410 Telfs, Austria',
    addressCountry: 'AT',
    url: 'https://www.volksschauspiele.at',
    description:
      'Die Tiroler Volksschauspiele sind ein jährliches Theaterfestival in Telfs mit Profis und Laien an wechselnden Spielorten; 2026 mit der Uraufführung von Felix Mitterers „Feuernacht“.',
    image:
      'https://images.unsplash.com/photo-1503095396549-807759245b35?w=1600&q=85&auto=format&fit=crop',
  },
};
