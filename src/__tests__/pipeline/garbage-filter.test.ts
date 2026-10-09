import { describe, it, expect } from 'vitest';
import { isGarbageTitle, isGarbageRow, namedPageKey, namedPageKeys, surplusBrokenTitleIds } from '@/lib/pipeline/garbage-filter';

// Befund 2026-10-06: der Gemeinde-Parser (vor #275) machte aus Kachel-Teilen
// eigene Events. Diese Titel stehen noch in der DB; der nächtliche Dedup
// unterdrückt alles, was isGarbageTitle erkennt.
describe('isGarbageTitle — Kachel-Teile statt Titel', () => {
  it.each([
    'Mehr Infos',
    'gefundene Veranstaltungen',
    'Suche ab:',
    'Datum der VeranstaltungMi,',
    'Datum der Veranstaltung',
  ])('überall: %s', (title) => {
    expect(isGarbageTitle(title)).toBe(true);
    expect(isGarbageTitle(title, { sourceName: 'Eventim' })).toBe(true);
  });

  it.each(['Mittwoch', ' Sonntag ', 'Heute', 'Morgen', 'Gemeindesaal'])(
    'bei Gemeinde-Aggregatoren: %s',
    (title) => {
      expect(isGarbageTitle(title, { sourceName: 'gemeinden-generic' })).toBe(true);
      expect(isGarbageTitle(title, { sourceName: 'gem2go' })).toBe(true);
    },
  );

  it('ein Stück namens "Montag" bei Eventim ist echt (Dschungel Wien, Feb. 2027)', () => {
    expect(isGarbageTitle('Montag', { sourceName: 'Eventim' })).toBe(false);
    expect(isGarbageTitle('Montag')).toBe(false);
  });

  it.each([
    'Bauernmarkt',
    'Sonntagsbrunch im Gemeindesaal',
    'Heute Abend: Jazz im Keller',
    'Mittwochs-Stammtisch',
    'Biomüll',
  ])('lässt echte Titel durch: %s', (title) => {
    expect(isGarbageTitle(title, { sourceName: 'gemeinden-generic' })).toBe(false);
  });
});

// Prod 2026-10-08: Das Ufo361-Konzert war samt Eventim-Zeile unterdrückt,
// weil „ufo361" nach Abzug der Ziffern nur drei Buchstaben hat. Ein Titel
// ist nur dann Datum/Uhrzeit, wenn außer Zahlen ausschließlich Datumswörter
// übrig bleiben.
describe('isGarbageTitle — Künstlernamen mit Ziffern sind echt', () => {
  it.each(['Ufo361', 'U2', 'Sum 41', 'Pop 2026', 'Ö3', 'Ö3 Wecker', '50 Cent', 'K2', 'Blink-182', 'AC/DC', 'ZZ Top',
    // Zahlen ohne Datums- oder Uhrzeitform: Stücktitel (TAO Dance Theater, Orwell)
    '17 & 18', '1984'])(
    '%s',
    (title) => {
      expect(isGarbageTitle(title)).toBe(false);
      expect(isGarbageTitle(title, { sourceName: 'Eventim' })).toBe(false);
    },
  );

  it.each([
    '15.04.2026 15:00 - 17:00 Uhr',
    'Mi.19:30-21:00Uhr',
    '10:00 Uhr',
    '18:00',
    '15 Okt',
    '15. Oktober 2026',
    'Sa, 24.10.2026 ab 19h',
    '15. und 16.10.',
    'x',
    '--',
    '20260929084918447.pdf',
    'Plakat_Herbstfest.JPG',
  ])('Datum, Uhrzeit, Dateiname oder Zeichenrest bleibt Müll: %s', (title) => {
    expect(isGarbageTitle(title)).toBe(true);
  });
});

// Abschlussprüfung 2026-10-08: Alle Navigationswort-Titel auf Prod kamen
// von Gemeinde-Aggregatoren ohne Ticket-Link. Einziger echter Treffer:
// Eventim „Archive" (Band, Gasometer 2027) mit Link auf genau dieses Event.
describe('isGarbageTitle — Navigationswort mit Event-Link', () => {
  const eventim = 'https://www.eventim.at/event/archive-gasometer-wien-12345678/';
  it('ein Link auf genau dieses Event macht ein Navigationswort zum Namen', () => {
    expect(isGarbageTitle('Archive', { sourceName: 'Eventim', ticketUrl: eventim })).toBe(false);
    expect(isGarbageTitle('Archive', { sourceName: 'Eventim' })).toBe(true);
    expect(isGarbageTitle('Kontakt', { sourceName: 'gemeinden-generic', ticketUrl: 'https://www.tulln.at/' })).toBe(true);
  });

  it('ein Datums-Titel bleibt als Titel Müll, auch mit Event-Link (kein Name)', () => {
    expect(isGarbageTitle('Donnerstag, 15.10.2026 , 19:00', { ticketUrl: 'https://www.tulln.at/veranstaltung/4711' })).toBe(true);
  });
});

// Stichprobe 2026-10-09: rund 115 Zeilen mit Datum statt Namen waren die
// einzige Zeile eines echten Events (Treibhaus „MI 09.12. 19:30 UHR" =
// Alfred Dorfer, KAPU, Ybbser Adventzauber). Unterdrückt wären sie ganz weg.
describe('isGarbageRow — Titel ohne Namen, aber eigene Event-Seite', () => {
  const dorfer = { title: 'MI 09.12. 19:30 UHR', source_name: 'innsbruck-clubs', start_date: '2026-12-09T18:30:00Z',
    source_url: 'https://www.treibhaus.at/programm/2026/12/09/15283-alfred-dorfer-gleich' };
  it('bleibt sichtbar, solange dieselbe Seite am Tag keine Zeile mit Namen liefert', () => {
    expect(isGarbageRow(dorfer, new Set())).toBe(false);
  });
  it('ist Müll, wenn dieselbe Seite am selben Tag eine Zeile mit Namen liefert', () => {
    expect(isGarbageRow(dorfer, new Set([namedPageKey({ ...dorfer, title: 'Alfred Dorfer: Gleich' })!]))).toBe(true);
  });
  it('Listen- oder Startseite belegt kein Event: Müll', () => {
    expect(isGarbageRow({ ...dorfer, source_url: 'https://www.bettel-alm.at/' }, new Set())).toBe(true);
  });
  it.each([
    'https://www.tulln.at/veranstaltungen/veranstaltungstermine?currentpage=2',
    'https://www.pinkafeld.at/events/liste/seite/2',
    'https://www.ziersdorf.at/termine/monat/2026-10',
    'https://www.gaenserndorf.at/termine/?pno=2',
    'https://www.frantschach.at/unsere-gemeinde/termine',
  ])('Listen- und Blätterseite belegt kein eigenes Event: %s', (url) => {
    expect(isGarbageRow({ ...dorfer, source_url: url }, new Set())).toBe(true);
  });
  it('ein Name derselben Website zur selben Minute an einer Nachbar-URL macht den Datums-Titel zum Kachelteil', () => {
    const date = { ...dorfer, title: 'Samstag,20:00Uhr - 22:00Uhr', start_date: '2026-11-21T19:00:00Z', source_url: 'https://www.mining.at/Herbstkonzert' };
    const named = { ...date, title: 'Herbstkonzert', source_url: 'https://www.mining.at/Herbstkonzert_1' };
    expect(isGarbageRow(date, new Set(namedPageKeys(named)))).toBe(true);
  });
  // Stichprobe Runde 3: auch Beschriftungen statt Namen auf der eigenen
  // Event-Seite sind das einzige Abbild echter Events (Neuberg
  // „Veranstaltungsdetails" = Fitmarsch, hard.at „Datum" = Vortrag).
  it.each(['Veranstaltungsdetails', 'Termin', 'Datum', 'mehr', 'Zum Hauptinhalt springen', 'mehr Informationen'])(
    'Beschriftung „%s" auf der eigenen Event-Seite ohne Namens-Zeile bleibt sichtbar',
    (title) => {
      expect(isGarbageRow({ ...dorfer, title }, new Set())).toBe(false);
    },
  );
  it.each(['Kontakt', 'Impressum', 'Datenschutz', 'Öffnungszeiten', 'Webcam', 'Test'])(
    'Nicht-Event-Seite „%s" bleibt Müll, auch mit eigener URL',
    (title) => {
      expect(isGarbageRow({ ...dorfer, title }, new Set())).toBe(true);
    },
  );
  it.each([
    'https://www.pyhra.gv.at/kalender?month=202609',
    'https://paternion.gv.at/unser-paternion/termine',
    'https://www.ort.at/events-nach-tag/2026-10-16/-',
  ])('Kalender-Navigation ist keine Event-Seite: %s', (url) => {
    expect(isGarbageRow({ ...dorfer, source_url: url }, new Set())).toBe(true);
  });

  // Stichprobe Runde 4 (2026-10-09)
  it('Platzhalter-Mitternacht verbindet keine fremden Events derselben Website („mehr" = Feuerlöscherüberprüfung)', () => {
    const mehr = { title: 'mehr', source_name: 'gemeinde-registry', start_date: '2026-10-10T00:00:00Z',
      source_url: 'https://www.niederleis.gv.at/Feuerloescherueberpruefung_10' };
    const other = { ...mehr, title: 'Oberleiser Steinläufer - Termine im Herbst', source_url: 'https://www.niederleis.gv.at/Oberleiser_Steinlaeufer' };
    expect(isGarbageRow(mehr, new Set(namedPageKeys(other)))).toBe(false);
  });
  it('„willKOMMEN!" auf der eigenen Seite ist ein Eventname (Plaudercafé)', () => {
    expect(isGarbageRow({ ...dorfer, title: 'willKOMMEN!', source_url: 'https://www.gaweinstal.at/willKOMMEN_3' }, new Set())).toBe(false);
  });
  it.each([
    ['Alle Termine', 'https://www.reichersberg.at/system/web/CalendarService.ashx?aID=123'],
    ['Veranstaltungskalender', 'https://www.raaba-grambach.at/veranstaltungen/listenansicht'],
    ['Kalender', 'https://www.kirchschlag.at/kalender?ajaxCalendar=1&mo=9&yr=2026'],
    ['weiter »', 'https://www.werfen.at/de/veranstaltung/abc'],
    ['von Mo. bis Fr.', 'https://www.hard.at/aktiv-in-hard/veranstaltungen/'],
    ['Heute', 'https://www.grosshoeflein.at/veranstaltungen/?eventDisplay=past'],
    ['09.10.2026', 'https://www.paldau.at/kundmachungen'],
    ['← Zurück zur Übersicht', 'https://www.frantschach.at/fileadmin/plakat.png'],
    ['Anzahl der Folgetermine 3 weitere Termine bis zum', 'https://www.mittersill.at/system/web/veranstaltung.aspx?menuonr=123'],
  ])('Listen-Beschriftung oder Listen-Link bleibt Müll: %s', (title, url) => {
    expect(isGarbageRow({ ...dorfer, title, source_name: 'gemeinden-generic', source_url: url }, new Set())).toBe(true);
  });
  it.each([
    'https://www.gmunden.at/kultur-freizeit-tourismus/keramik/veranstaltungen/',
    'https://www.tulln.at/veranstaltungen/veranstaltungstermine?tx_tulln_events%5B%40widget_1%5D%5BcurrentPage%5D=2&cHash=e13d02dc52d9',
  ])('Bereichsliste und TYPO3-Blätterseite sind keine Event-Seite: %s', (url) => {
    expect(isGarbageRow({ ...dorfer, title: '30.09. –', source_url: url }, new Set())).toBe(true);
  });
  it('mehrere kaputte Titel derselben Event-Seite am selben Tag: eine Zeile bleibt, je echter Uhrzeit eine', () => {
    const url = 'https://www.mining.ooe.gv.at/Vortrag_Meine_Seele_staerken_';
    const month = { id: 'm', title: 'November', source_name: 'gemeinden-generic', start_date: '2026-11-04T03:11:00Z', source_url: url };
    const time = { ...month, id: 't', title: 'Mittwoch,19:00Uhr - 20:30Uhr', start_date: '2026-11-04T18:00:00Z' };
    expect([...surplusBrokenTitleIds([month, time], new Set())]).toEqual(['m']);
    const second = { ...time, id: 's', title: 'Mittwoch,21:00Uhr', start_date: '2026-11-04T20:00:00Z' };
    expect([...surplusBrokenTitleIds([time, second], new Set())]).toEqual([]);
    // Beide mit Datums-Uhrzeit (04.11. als 04:11): die Zeile mit Uhrzeit im Titel bleibt.
    expect([...surplusBrokenTitleIds([month, { ...time, id: 'x', start_date: month.start_date }], new Set())]).toEqual(['m']);
  });
  it('Gem2Go-Zähler am Seitennamen: die Zeile mit Namen auf „…_1" macht die kaputten Zeilen zum Kachelteil', () => {
    const junk = { title: 'Mittwoch,19:00Uhr - 20:30Uhr', source_name: 'gemeinden-generic', start_date: '2026-11-04T03:11:00Z',
      source_url: 'https://www.mining.ooe.gv.at/Vortrag_Meine_Seele_staerken_' };
    const named = { title: 'Vortrag "Meine Seele stärken"', source_name: 'gem2go', start_date: '2026-11-04T18:00:00Z',
      source_url: 'https://www.mining.ooe.gv.at/Vortrag_Meine_Seele_staerken_1' };
    expect(isGarbageRow(junk, new Set(namedPageKeys(named)))).toBe(true);
  });
  it('dieselbe Event-Seite unter anderem Pfad liefert den Namen („Tickets" neben dem Programm-Eintrag)', () => {
    const tickets = { ...dorfer, title: 'Tickets', start_date: '2026-10-09T00:00:00Z',
      source_url: 'https://treibhaus.at/karten/2026/10/09/15129-renaud-garcia-fons-blue-maqam' };
    const named = { ...tickets, title: 'Renaud Garcia-Fons: Blue Maqam',
      source_url: 'https://treibhaus.at/programm/2026/10/09/15129-renaud-garcia-fons-blue-maqam' };
    expect(isGarbageRow(tickets, new Set(namedPageKeys(named)))).toBe(true);
  });
});

describe('isGarbageTitle — Sprungmarken und Beschriftungen (Prod 2026-10-09)', () => {
  it.each([
    'Zum Inhalt springen', 'Zur Navigation springen', 'Zum Hauptinhalt springen', 'Springe zum Anfang der Seite',
    'Springe zur Subnavigation', 'Springe zur rechten Spalte', 'zum Hauptmenü', 'Zurück zum Seitenanfang',
    'Weiter zum Inhalt', 'Alle Termine', 'Termine', 'Veranstaltungen', 'Gefundene Termine', 'Mehr', 'Dieser Monat',
    'This Month', 'Tickets', 'AUSVERKAUFT', 'Test', '0 Veranstaltungen, 18', '19:30, Eintritt: € 15/18/20', '16:00, Eintritt: Frei',
    'Termin', 'Events', 'Datum', 'DATUM :', 'Nach oben scrollen', 'weiter »', 'Eventkalender', 'Veranstaltungskalender',
    'Tipp speichern', 'In Outlook übernehmen', 'Webcam', 'Karteninhalte zulassen', 'Aktuelles', 'Neuigkeiten', 'Veranstaltungsdetails',
  ])('%s', (title) => {
    expect(isGarbageTitle(title)).toBe(true);
  });
  it.each([
    'Anzahl der Folgetermine: 3',
    '11:00 Uhr bis 00:00 Uhr | Alle Termine',
    'Tipp speichern/in Outlook übernehmen',
    '{"@context": "http://schema.org","@type": "Event",',
    'mehr lesen', 'Kundmachungen', 'Aktuelle Termine', 'FREI:WILLIG',
  ])('weitere Beschriftung: %s', (title) => {
    expect(isGarbageTitle(title)).toBe(true);
  });
  it.each([
    'Lesen Sie mehr', 'mehr Information', 'Parteienverkehr', 'Amtszeiten', 'Quicklinks', 'Nächste Veranstaltung',
    'Montag,19:00Uhr QR Code öffnen', 'Am , Beginn: 17:00 Uhr', '6.10., 3.11. und , jeweils 18 bis 20 Uhr',
    'Traungasse 5-7, 4810 Gmunden, Österreich', 'Weitere Termine vorhanden', 'Veranstaltungsvorschau',
  ])('Beschriftung aus Stichprobe Runde 4: %s', (title) => {
    expect(isGarbageTitle(title)).toBe(true);
  });
  it('„übermorgen" nur bei Gemeinde-Aggregatoren', () => {
    expect(isGarbageTitle('übermorgen', { sourceName: 'gemeinden-generic' })).toBe(true);
  });
  it('Monatsname allein bei Gemeinde-Aggregatoren', () => {
    expect(isGarbageTitle('OKTOBER', { sourceName: 'gemeinden-generic' })).toBe(true);
    expect(isGarbageTitle('Oktober')).toBe(false);
  });
  it('Wochentag mit „bis" bei Gemeinde-Aggregatoren', () => {
    expect(isGarbageTitle('Samstag, bis', { sourceName: 'gemeinde-registry' })).toBe(true);
  });
  it.each(['Termine der Bibliothek', 'Mehr als Worte', 'Testament – Kabarett'])('echte Titel bleiben: %s', (title) => {
    expect(isGarbageTitle(title)).toBe(false);
  });
});
