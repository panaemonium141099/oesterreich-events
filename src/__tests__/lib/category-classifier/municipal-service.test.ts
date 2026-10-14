/**
 * Gemeinde-Dienste (Entscheidung 2026-10-14). Alle Titel stammen aus dem
 * Prod-Bestand vom 2026-10-14: Positivfälle aus den sichtbaren künftigen
 * Terminen, Negativfälle aus echten Veranstaltungen mit denselben Wörtern.
 */
import { describe, it, expect } from 'vitest';
import {
  isMunicipalService,
  isWasteOrAdminEvent,
  municipalServiceKind,
} from '@/lib/category-classifier/municipal-service';

describe('municipalServiceKind', () => {
  it('Müllabfuhr, Sammelstellen und Sammelaktionen', () => {
    for (const t of [
      'Biomüll', 'Sperrmüll- und Problemstoffsammlung', 'Restmüll', 'Gelber Sack', 'Altstoffsammelzentrum',
      'Altpapier', 'Grünschnittaktion', 'Restmüllabfuhr', 'Biotonne', 'Recyclinghof von 13:00 bis 17:00 Uhr!',
      'Biomüll ()', 'Biomüll ( 06:00)', 'Grünschnittplatz', 'Hausmüll', 'Übernahmestelle Baum- und Strauchschnitt',
      'Müllabfuhr: Biomüll', 'Alt- und Wertstoffsammelzentrum', 'ASZ-Mülldeponie', 'Bioabfall', 'Deponie',
      'Gratis Grünschnitt Entsorgung', 'Müll 1', 'Müll 2', 'HH2: 2-wöchentliche Müll-Abholung', 'MÜLLTERMINE',
      'Öffnungszeiten Müllhof', 'Müllsackausgabe im Gemeindeamt für das Jahr 2027', 'Gelbe(r) Sack/Tonne ()',
      'Kunststoff, Metall & Verpackungen (gelbe Tonne) ()', 'Papier - rote Tonne ()', 'Papier Abholung',
      'Papierentsorgung - Bachg., Hirmerstr., Kleine G., Landstr., Steinbrunner Str', 'Leicht- und Metallverpackungen',
      'Verpackungskunststoff', 'Kunststoffverpackung am 21.10.2026', 'Baum- und Strauchschnitt', 'Strauchschnitt',
      'Strauch-Hecken-Baumschnitt Sammlung', 'Baumschnittsammlung 24.08. – 25.10.2026', 'Strauchabschnittabholung Dienstag',
      'Mobiler Häckseldienst', 'Häckselaktion', 'Silofolienentsorgung', 'Siloballen - Entsorgung',
      'Agrarfolien-Sammlung beim ASZ', 'ASZ Raaba-Grambach', 'Sperrmüll ASZ-Fernitz (Fr)', 'ReVital Sammeltag im ASZ Rainbach i.M.',
      'ReVital-Sammlung in den ASZ', 'Kompostabfuhr', 'Altkleidersammlung', 'Zusätzliche Möglichkeit für Speiseöl-Entsorgung',
      'Erdaushubdeponie geöffnet', 'Wertstoffhof geöffnet', 'Recyclinghof ist am 25.12.2026 und 26.12.2026 geschlossen',
      '02.12.2026 (Mittwoch) Gelber Sack - Abholungen 2026', '23 Dez. Restmüllabfuhr 23.12.2026 Mehr Infos',
      'Autowrackentsorgung', 'Grün- und Strauchschnitt', 'Abgabemöglichkeit Grünmüll', 'Landwirtschaftsfoliensammlung',
    ]) {
      expect(municipalServiceKind(t), t).toBe('waste');
    }
  });

  it('Sprechtage und Sprechstunden', () => {
    for (const t of [
      'Sozialsprechtag', 'Kostenlose Pflegesprechstunde', 'Sprechtag der ÖGK', 'Bausprechtag', 'Notarsprechtag',
      'Bürgermeister-Sprechstunde nach Vereinbarung', 'SVS-Beratungstage', 'Sprechtagstermine des KOBV',
      'KOBV-Sprech- und Beratungstage 2026', 'Steuersprechstunde', 'Sprechstunde der Pflegenahversorgung',
      'Tiroler Kriegsopfer- und Behindertenverband mit Sprechtag in Kufstein', 'FORUM BESSER HÖREN | Sprechtage in Wolfsberg',
      'HebammensprechstundeKurs, Seminar, Tagung, Vortrag, Lesung', 'Erweiterung Windpark und Umspannwerk – Sprechtag',
    ]) {
      expect(municipalServiceKind(t), t).toBe('consultation');
    }
  });

  it('Klimaticket-Verleih und Dorfservice', () => {
    expect(municipalServiceKind('Klimaticket')).toBe('klimaticket');
    expect(municipalServiceKind('VOR-KlimaTicket - Reservierung')).toBe('klimaticket');
    expect(municipalServiceKind('Dorfservice')).toBe('dorfservice');
    expect(municipalServiceKind('Dorfservice ()')).toBe('dorfservice');
  });

  it('echte Veranstaltungen bleiben', () => {
    for (const t of [
      // Gemeinschafts-Aktionen
      'Flurreinigung', 'Müllsammelaktion für Kinder', 'Müllsammelaktion', 'Plogging - Bewegung und Müll sammeln',
      'Repair Café', 'Gesunde Gemeinde: Yoga für Anfänger', 'Gesunde Gemeinde',
      // Stücke und Vorträge mit Müll-Wörtern
      'Topolina rettet den Müll', 'Kasperl und der Müll', 'Klumpat der Mülltroll',
      'Recycling Reloaded – Was du über Müll wissen musst!', 'More than Recycling. Die Ausstellung zur Kreislaufwirtschaft',
      'Wurmkistenvortrag – Würmer, Kompostierung & vieles mehr!', 'Kompost Tag #23: Propositions for our Garden',
      'MIT 50 IN DIE TONNE! - Ivo Schneiders Roman', 'Müllers Büro — Kabarett', 'Die schöne Müllerin',
      // Veranstaltungen an Entsorgungsorten
      'Besichtigung Recyclinghof Mühldorf', 'Ferienspiel: Besuch im Wertstoff-Sammelzentrum',
      'Tag der offenen Tür im ASZ Raaba-Grambach', 'Tauschtag im ASZ - Neues Leben für schöne Dinge',
      'Mobiler Upcycling Tag - ASZ Braunau', 'Informationsabend - Neues Wertstoffzentrum - Inbetriebnahme 04.11.2026',
      'Tag der offenen Tür bei Struber Entsorgung GmbH', 'Kanalsanierungsarbeiten: Parken im Bereich ehem. ASZ untersagt',
      // Christbaum, Baumschnitt-Kurs, Abholung
      'Christbaumverkauf', 'Christbaumtauchen der Wasserrettung Zell am See', 'Obstbaumschnittkurs', 'Obstbaumschnitt',
      'Baumschnittkurs für Anfänger', 'Friedenslicht Abholung', 'Heckentag - Abholung',
      // Klimaticket/Dorfservice nur als Dienst
      'Mit dem Klimaticket zum Konzert', 'Dorfservice-Spielenachmittag',
      'Kriminal Dinner: Blutbad im Gemeinderat', 'Konzert im Park', null, undefined, '',
    ]) {
      expect(municipalServiceKind(t), String(t)).toBeNull();
    }
  });
});

describe('isWasteOrAdminEvent (Smart-Suche)', () => {
  it('filtert Gemeinde-Dienste und zusätzlich Sitzungen und Amtsstunden', () => {
    for (const t of ['Sperrmüll', 'Abfallsammelstelle geöffnet', 'Deponie', 'Sprechtag des Bürgermeisters', 'Gemeinderatssitzung', 'Amtsstunden', 'Klimaticket']) {
      expect(isWasteOrAdminEvent(t), t).toBe(true);
    }
    // Sitzungen bleiben auf der Seite, nur die Suche nimmt sie heraus.
    expect(isMunicipalService('Gemeinderatssitzung')).toBe(false);
    for (const t of ['Konzert im Park', 'Flohmarkt Eisenstadt', 'Müllsammelaktion für Kinder', null]) {
      expect(isWasteOrAdminEvent(t), String(t)).toBe(false);
    }
  });
});
