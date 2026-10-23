// Echte Treffer von /api/search/semantic (23.10.2026, Query "party wien
// heute abend") für das Szenario „Bin Student und will heute abend billig
// saufen gehen". Uhrzeiten in Wiener Zeit, Preise ohne DB-Wert fürs Mockup
// mit * ergänzt. `why` ist die Begründung, die das Modell pro Karte liefern
// soll, `oeffi` die Öffi-Zeit vom vorigen Stopp (Mockup-Annahme).
const F = 'https://cdn2.falter.at/events/';
const T = 'https://www.oeticket.com/obj/media/AT-eventim/teaser/222x222/';

window.QUERY = 'Bin Student und will heute abend billig saufen gehen';
window.UNDERSTOOD = ['Heute Abend', 'Wien, in deiner Nähe', 'Günstig: bis 15 €', 'Studenten', 'Ausgehen'];

// Lokale aus der Tabelle `venues` (OSM-Import, echte Zeilen Wien, Öffnungszeiten aus osm_tags).
// Noch kein Retrieval-Pfad in runSmartSearch; Happy-Hour-Angaben gibt es nirgends.
window.VENUES = [
  { t: 'Bar Pani', sub: 'Cocktailbar', bez: '7. Neubau', open: 'bis 02:00', initial: 'B', why: 'Fr und Sa bis 2 Uhr, 6 Minuten vom Rhiz' },
  { t: 'Truth and Dare', sub: 'Cocktailbar', bez: '1. Innere Stadt', open: 'bis 02:00', initial: 'T', why: 'Di bis Sa ab 18 Uhr' },
  { t: "Baburder's", sub: 'Karaokebar', bez: '15. Fünfhaus', open: 'bis 02:00', initial: 'B', why: 'Karaoke, Fr und Sa bis 2 Uhr' },
  { t: 'Happy Hour?', sub: 'Angebote fehlen', bez: 'alle Lokale', open: 'offen', initial: '?', why: 'Dafür bräuchte es Specials vom Lokal selbst' },
];

window.EVENTS = [
  { id: 'e1', t: 'Temporäre Objekte / Gert / Tutti Dilemma', time: '20:00', slot: 'vor', venue: 'Venster99', bez: '9. Alsergrund', cat: 'Konzert', price: 'Spende*', img: F+'31514.jpeg?width=300&aspect_ratio=1:1&crop=fill', lat: 48.2182, lng: 16.3426, why: 'Drei Bands, Bier um 3,50, freier Eintritt gegen Spende' },
  { id: 'e2', t: 'The Jaybirds / The Fabulous Danes', time: '20:00', slot: 'vor', venue: 'Kramladen', bez: '8. Josefstadt', cat: 'Konzert', price: 'Gratis*', img: F+'129637.jpeg?width=300&aspect_ratio=1:1&crop=fill', lat: 48.2109, lng: 16.3391, why: 'Rockabilly zum Vorglühen, Gürtel-Lokal' },
  { id: 'e3', t: 'Frau Mayer Hausband', time: '20:15', slot: 'vor', venue: 'Frau Mayer', bez: '1. Innere Stadt', cat: 'Live', price: 'Gratis*', img: 'https://www.partytimer.at/build/assets/background-85fb6cd3.jpg', lat: 48.2139, lng: 16.3712, why: 'Hausband, kein Eintritt, mitten in der Stadt' },
  { id: 'e4', t: 'Rock the Dancefloor', time: '22:00', slot: 'party', venue: 'Weberknecht', bez: '16. Ottakring', cat: 'Party', price: '5 €*', img: F+'20123.jpeg?width=300&aspect_ratio=1:1&crop=fill', lat: 48.2102, lng: 16.3386, why: 'Billigster Eintritt heute, Gürtel-Klassiker' },
  { id: 'e5', t: 'Team Breakbeat', time: '23:00', slot: 'party', venue: 'Rhiz', bez: '8. Josefstadt', cat: 'Party', price: '8 €*', img: F+'20088.jpeg?width=300&aspect_ratio=1:1&crop=fill', lat: 48.2108, lng: 16.3391, why: 'Unter dem Gürtelbogen, 2 Minuten vom Kramladen' },
  { id: 'e6', t: 'Bad Decisions #001', time: '23:00', slot: 'party', venue: 'Flex', bez: '1. Innere Stadt', cat: 'Party', price: '10 €*', img: 'https://flex.at/wp-content/uploads/2026/10/825330017_122116915707442710_5888104695366539190_n.jpg', lat: 48.2178, lng: 16.3709, why: 'Am Donaukanal, bis 6 Uhr offen' },
  { id: 'e7', t: 'SHE hits OAG', time: '23:00', slot: 'party', venue: 'FLUCC', bez: '2. Leopoldstadt', cat: 'Party', price: '8 bis 13,50 €', img: T+'2026/ContentMarei/SHE_hits_OAG_c_SHH_&_OR_222.jpg', lat: 48.2176, lng: 16.3915, why: 'Vorverkauf 8 €, Praterstern, Nachtbus vor der Tür', ticket: true },
  { id: 'e8', t: 'Werk Resident Night', time: '23:00', slot: 'party', venue: 'dasWERK', bez: '9. Alsergrund', cat: 'Party', price: '13,50 €', img: T+'2026/ContentMarei/WERK_Resident_Night_c_Catherine_Spet_222.jpg', lat: 48.2338, lng: 16.3584, why: 'Techno unterm Spittelauer Viadukt', ticket: true },
  { id: 'e9', t: 'F I R S T', time: '23:00', slot: 'party', venue: 'Praterdome', bez: '2. Leopoldstadt', cat: 'Party', price: '12 €*', img: 'https://prater-dome.disco2app.com/media/cache/web/events/435/image/63014.webp?datetime=1789557784&context=web', lat: 48.2152, lng: 16.3989, why: 'Großraumdisco, Studentenrabatt an der Kassa*' },
  { id: 'e10', t: 'Konzept Vienna', time: '23:59', slot: 'spaet', venue: 'Flucc Deck', bez: '2. Leopoldstadt', cat: 'Party', price: '10 €*', img: F+'3464.jpeg?width=300&aspect_ratio=1:1&crop=fill', lat: 48.2177, lng: 16.3932, why: 'Wenn es nach Mitternacht weitergehen soll' },
  { id: 'e11', t: 'Efeu', time: '20:00', slot: 'alt', venue: 'Cafe Carina', bez: '8. Josefstadt', cat: 'Konzert', price: '23 €', img: F+'31508.jpeg?width=300&aspect_ratio=1:1&crop=fill', lat: 48.2082, lng: 16.3738, why: 'Über dem Budget, aber Konzert statt Club', over: true },
  { id: 'e12', t: '18&below', time: '17:00', slot: 'alt', venue: 'Flucc', bez: '2. Leopoldstadt', cat: 'Party', price: 'Gratis*', img: F+'140040.jpeg?width=300&aspect_ratio=1:1&crop=fill', lat: 48.2177, lng: 16.3932, why: 'Früher Start, Jugendparty bis 22 Uhr' },
];

window.SHELVES = [
  { k: 'vor', h: 'Vorglühen ab 20 Uhr', sub: 'Gratis oder Spende, Livemusik' },
  { k: 'party', h: 'Partys heute unter 15 €', sub: 'Einlass ab 22 Uhr' },
  { k: 'spaet', h: 'Nach Mitternacht', sub: 'Falls es länger wird' },
  { k: 'alt', h: 'Knapp daneben', sub: 'Über Budget oder früher am Abend' },
];

window.FOLLOWUPS = ['Nur gratis', 'Eher am Gürtel', 'Später, ab 23 Uhr', 'Lieber Konzert als Club', 'Wir sind zu sechst'];

window.byId = id => window.EVENTS.find(e => e.id === id);
