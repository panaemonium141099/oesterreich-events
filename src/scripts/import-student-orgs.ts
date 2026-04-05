/**
 * Student Organization Registry Import Script
 *
 * Imports OeH (Oesterreichische Hochschuelerschaft), ESN (Erasmus Student Network),
 * IAESTE, AIESEC, and AEGEE sections as venue entries into the Supabase venues table.
 *
 * Each student org becomes a venue with:
 *   type = 'student_org'
 *   is_student_relevant = true
 *   registry_source = 'oeh' | 'esn' | 'iaeste' | 'aiesec' | 'aegee'
 *
 * Run: npx tsx src/scripts/import-student-orgs.ts
 * Dry run: npx tsx src/scripts/import-student-orgs.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegistrySource = 'oeh' | 'esn' | 'iaeste' | 'aiesec' | 'aegee';

interface StudentOrgEntry {
  name: string;
  subtype: string;
  city: string;
  bundesland: string;
  latitude: number;
  longitude: number;
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  event_feed_url: string | null;
  registry_source: RegistrySource;
  address: string | null;
  postal_code: string | null;
}

// ---------------------------------------------------------------------------
// Normalization helper
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, '')     // strip special chars
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Austrian city coordinates (main university cities)
// ---------------------------------------------------------------------------

const CITY_COORDS: Record<string, { lat: number; lng: number; plz: string; bundesland: string }> = {
  'Wien':         { lat: 48.2082, lng: 16.3738, plz: '1010', bundesland: 'Wien' },
  'Graz':         { lat: 47.0707, lng: 15.4395, plz: '8010', bundesland: 'Steiermark' },
  'Linz':         { lat: 48.3069, lng: 14.2858, plz: '4020', bundesland: 'Oberoesterreich' },
  'Salzburg':     { lat: 47.8095, lng: 13.0550, plz: '5020', bundesland: 'Salzburg' },
  'Innsbruck':    { lat: 47.2654, lng: 11.3927, plz: '6020', bundesland: 'Tirol' },
  'Klagenfurt':   { lat: 46.6247, lng: 14.3050, plz: '9020', bundesland: 'Kaernten' },
  'Leoben':       { lat: 47.3826, lng: 15.0979, plz: '8700', bundesland: 'Steiermark' },
  'Krems':        { lat: 48.4085, lng: 15.6139, plz: '3500', bundesland: 'Niederoesterreich' },
  'St. Poelten':  { lat: 48.2047, lng: 15.6256, plz: '3100', bundesland: 'Niederoesterreich' },
  'Kufstein':     { lat: 47.5833, lng: 12.1667, plz: '6330', bundesland: 'Tirol' },
  'Eisenstadt':   { lat: 47.8453, lng: 16.5189, plz: '7000', bundesland: 'Burgenland' },
  'Dornbirn':     { lat: 47.4125, lng: 9.7417,  plz: '6850', bundesland: 'Vorarlberg' },
  'Wiener Neustadt': { lat: 47.8133, lng: 16.2467, plz: '2700', bundesland: 'Niederoesterreich' },
  'Wels':         { lat: 48.1575, lng: 14.0289, plz: '4600', bundesland: 'Oberoesterreich' },
  'Villach':      { lat: 46.6103, lng: 13.8558, plz: '9500', bundesland: 'Kaernten' },
  'Tulln':        { lat: 48.3267, lng: 15.8831, plz: '3430', bundesland: 'Niederoesterreich' },
  'Hagenberg':    { lat: 48.3689, lng: 14.5144, plz: '4232', bundesland: 'Oberoesterreich' },
  'Steyr':        { lat: 48.0427, lng: 14.4213, plz: '4400', bundesland: 'Oberoesterreich' },
  'Kapfenberg':   { lat: 47.4439, lng: 15.2889, plz: '8605', bundesland: 'Steiermark' },
  'Bad Gleichenberg': { lat: 46.8761, lng: 15.9072, plz: '8344', bundesland: 'Steiermark' },
  'Feldkirchen':  { lat: 46.7231, lng: 14.0950, plz: '9560', bundesland: 'Kaernten' },
  'Pinkafeld':    { lat: 47.3736, lng: 16.1225, plz: '7423', bundesland: 'Burgenland' },
  'Baden':        { lat: 48.0069, lng: 16.2308, plz: '2500', bundesland: 'Niederoesterreich' },
  'Hollabrunn':   { lat: 48.5600, lng: 15.9900, plz: '2020', bundesland: 'Niederoesterreich' },
  'Linz-Urfahr':  { lat: 48.3119, lng: 14.2862, plz: '4040', bundesland: 'Oberoesterreich' },
};

function cityInfo(city: string) {
  const info = CITY_COORDS[city];
  if (!info) throw new Error(`Unknown city: ${city}. Add it to CITY_COORDS.`);
  return info;
}

// ---------------------------------------------------------------------------
// OeH sections (Oesterreichische Hochschuelerschaft)
// University-level student unions at each public university
// ---------------------------------------------------------------------------

const OEH_SECTIONS: StudentOrgEntry[] = [
  // Public Universities
  { name: 'OeH Uni Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://oeh.univie.ac.at/', facebook_url: 'https://www.facebook.com/oeh.univie', instagram_url: 'https://www.instagram.com/oeh_uniwien/', event_feed_url: 'https://oeh.univie.ac.at/veranstaltungen/', registry_source: 'oeh', address: 'Universitaetsstrasse 7, 1010 Wien', postal_code: '1010' },
  { name: 'OeH TU Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://htu.at/', facebook_url: 'https://www.facebook.com/haboratUL', instagram_url: 'https://www.instagram.com/htuwien/', event_feed_url: 'https://htu.at/events', registry_source: 'oeh', address: 'Wiedner Hauptstrasse 8-10, 1040 Wien', postal_code: '1040' },
  { name: 'OeH WU Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://www.oeh-wu.at/', facebook_url: 'https://www.facebook.com/oehwu', instagram_url: 'https://www.instagram.com/oeh_wu/', event_feed_url: 'https://www.oeh-wu.at/events', registry_source: 'oeh', address: 'Welthandelsplatz 1, 1020 Wien', postal_code: '1020' },
  { name: 'OeH BOKU Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://oeh.boku.ac.at/', facebook_url: 'https://www.facebook.com/oehboku', instagram_url: 'https://www.instagram.com/oeh_boku/', event_feed_url: null, registry_source: 'oeh', address: 'Peter-Jordan-Strasse 76, 1190 Wien', postal_code: '1190' },
  { name: 'OeH MedUni Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://www.oeh-meduniwien.at/', facebook_url: 'https://www.facebook.com/oehmeduniwien', instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Spitalgasse 23, 1090 Wien', postal_code: '1090' },
  { name: 'OeH VetMed Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://oeh.vetmeduni.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Veterinaerplatz 1, 1210 Wien', postal_code: '1210' },
  { name: 'OeH Angewandte Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://hufak.net/', facebook_url: null, instagram_url: 'https://www.instagram.com/hufak/', event_feed_url: null, registry_source: 'oeh', address: 'Oskar-Kokoschka-Platz 2, 1010 Wien', postal_code: '1010' },
  { name: 'OeH Akademie der bildenden Kuenste Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://oeh.akbild.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Schillerplatz 3, 1010 Wien', postal_code: '1010' },
  { name: 'OeH MDW Wien', subtype: 'oeh_uni', city: 'Wien', ...cityInfo('Wien'), website: 'https://www.hmdw.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Anton-von-Webern-Platz 1, 1030 Wien', postal_code: '1030' },
  { name: 'OeH Uni Graz', subtype: 'oeh_uni', city: 'Graz', ...cityInfo('Graz'), website: 'https://oeh.uni-graz.at/', facebook_url: 'https://www.facebook.com/oehunigraz', instagram_url: 'https://www.instagram.com/oeh_unigraz/', event_feed_url: 'https://oeh.uni-graz.at/de/events/', registry_source: 'oeh', address: 'Schubertstrasse 6a, 8010 Graz', postal_code: '8010' },
  { name: 'OeH TU Graz', subtype: 'oeh_uni', city: 'Graz', ...cityInfo('Graz'), website: 'https://htu.tugraz.at/', facebook_url: 'https://www.facebook.com/HTUGraz', instagram_url: 'https://www.instagram.com/htu_graz/', event_feed_url: 'https://htu.tugraz.at/events', registry_source: 'oeh', address: 'Rechbauerstrasse 12, 8010 Graz', postal_code: '8010' },
  { name: 'OeH MedUni Graz', subtype: 'oeh_uni', city: 'Graz', ...cityInfo('Graz'), website: 'https://oeh.medunigraz.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Neue Stiftingtalstrasse 6, 8010 Graz', postal_code: '8010' },
  { name: 'OeH KUG Graz', subtype: 'oeh_uni', city: 'Graz', ...cityInfo('Graz'), website: 'https://oeh.kug.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Leonhardstrasse 15, 8010 Graz', postal_code: '8010' },
  { name: 'OeH Uni Innsbruck', subtype: 'oeh_uni', city: 'Innsbruck', ...cityInfo('Innsbruck'), website: 'https://www.oeh.cc/', facebook_url: 'https://www.facebook.com/oehinnsbruck', instagram_url: 'https://www.instagram.com/oeh_innsbruck/', event_feed_url: 'https://www.oeh.cc/veranstaltungen', registry_source: 'oeh', address: 'Josef-Hirn-Strasse 7, 6020 Innsbruck', postal_code: '6020' },
  { name: 'OeH MedUni Innsbruck', subtype: 'oeh_uni', city: 'Innsbruck', ...cityInfo('Innsbruck'), website: 'https://oeh.i-med.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Schoepfstrasse 41, 6020 Innsbruck', postal_code: '6020' },
  { name: 'OeH Mozarteum Salzburg', subtype: 'oeh_uni', city: 'Salzburg', ...cityInfo('Salzburg'), website: 'https://oeh.moz.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Mirabellplatz 1, 5020 Salzburg', postal_code: '5020' },
  { name: 'OeH Uni Salzburg', subtype: 'oeh_uni', city: 'Salzburg', ...cityInfo('Salzburg'), website: 'https://oeh-salzburg.at/', facebook_url: 'https://www.facebook.com/oehsalzburg', instagram_url: 'https://www.instagram.com/oeh_salzburg/', event_feed_url: null, registry_source: 'oeh', address: 'Kaigasse 28, 5020 Salzburg', postal_code: '5020' },
  { name: 'OeH JKU Linz', subtype: 'oeh_uni', city: 'Linz', ...cityInfo('Linz'), website: 'https://oeh.jku.at/', facebook_url: 'https://www.facebook.com/oehjku', instagram_url: 'https://www.instagram.com/oeh_jku/', event_feed_url: 'https://oeh.jku.at/events', registry_source: 'oeh', address: 'Altenberger Strasse 69, 4040 Linz', postal_code: '4040' },
  { name: 'OeH Kunstuni Linz', subtype: 'oeh_uni', city: 'Linz', ...cityInfo('Linz'), website: 'https://oeh.ufg.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Hauptplatz 6, 4020 Linz', postal_code: '4020' },
  { name: 'OeH AAU Klagenfurt', subtype: 'oeh_uni', city: 'Klagenfurt', ...cityInfo('Klagenfurt'), website: 'https://oeh.aau.at/', facebook_url: 'https://www.facebook.com/oehaau', instagram_url: 'https://www.instagram.com/oehaau/', event_feed_url: 'https://oeh.aau.at/veranstaltungen/', registry_source: 'oeh', address: 'Universitaetsstrasse 65-67, 9020 Klagenfurt', postal_code: '9020' },
  { name: 'OeH Montanuni Leoben', subtype: 'oeh_uni', city: 'Leoben', ...cityInfo('Leoben'), website: 'https://oeh.unileoben.ac.at/', facebook_url: 'https://www.facebook.com/oeh.leoben', instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Franz-Josef-Strasse 18, 8700 Leoben', postal_code: '8700' },
  { name: 'OeH Donau-Uni Krems', subtype: 'oeh_uni', city: 'Krems', ...cityInfo('Krems'), website: 'https://www.oeh-duk.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Dr.-Karl-Dorrek-Strasse 30, 3500 Krems', postal_code: '3500' },

  // OeH at major FH (Fachhochschulen)
  { name: 'OeH FH Technikum Wien', subtype: 'oeh_fh', city: 'Wien', ...cityInfo('Wien'), website: 'https://oeh.technikum-wien.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Hoechstaedtplatz 6, 1200 Wien', postal_code: '1200' },
  { name: 'OeH FH Campus Wien', subtype: 'oeh_fh', city: 'Wien', ...cityInfo('Wien'), website: 'https://www.oeh-fhcw.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Favoritenstrasse 226, 1100 Wien', postal_code: '1100' },
  { name: 'OeH FH Wien WKW', subtype: 'oeh_fh', city: 'Wien', ...cityInfo('Wien'), website: 'https://oeh.fh-wien.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Waehringer Guertel 97, 1180 Wien', postal_code: '1180' },
  { name: 'OeH FH BFI Wien', subtype: 'oeh_fh', city: 'Wien', ...cityInfo('Wien'), website: 'https://oeh.fh-vie.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Wohlmutstrasse 22, 1020 Wien', postal_code: '1020' },
  { name: 'OeH FH Joanneum', subtype: 'oeh_fh', city: 'Graz', ...cityInfo('Graz'), website: 'https://oeh.fh-joanneum.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Alte Poststrasse 149, 8020 Graz', postal_code: '8020' },
  { name: 'OeH FH Salzburg', subtype: 'oeh_fh', city: 'Salzburg', ...cityInfo('Salzburg'), website: 'https://oeh.fh-salzburg.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Urstein Sued 1, 5412 Puch bei Salzburg', postal_code: '5412' },
  { name: 'OeH FH Oberoesterreich', subtype: 'oeh_fh', city: 'Linz', ...cityInfo('Linz'), website: 'https://oeh.fh-ooe.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Franz-Fritsch-Strasse 11, 4600 Wels', postal_code: '4600' },
  { name: 'OeH FH St. Poelten', subtype: 'oeh_fh', city: 'St. Poelten', ...cityInfo('St. Poelten'), website: 'https://oeh.fhstp.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Matthias-Corvinus-Strasse 15, 3100 St. Poelten', postal_code: '3100' },
  { name: 'OeH FH Kaernten', subtype: 'oeh_fh', city: 'Villach', ...cityInfo('Villach'), website: 'https://oeh.fh-kaernten.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Europastrasse 4, 9524 Villach', postal_code: '9524' },
  { name: 'OeH FH Vorarlberg', subtype: 'oeh_fh', city: 'Dornbirn', ...cityInfo('Dornbirn'), website: 'https://oeh.fhv.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Hochschulstrasse 1, 6850 Dornbirn', postal_code: '6850' },
  { name: 'OeH FH Kufstein', subtype: 'oeh_fh', city: 'Kufstein', ...cityInfo('Kufstein'), website: 'https://oeh.fh-kufstein.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Andreas-Hofer-Strasse 7, 6330 Kufstein', postal_code: '6330' },
  { name: 'OeH IMC FH Krems', subtype: 'oeh_fh', city: 'Krems', ...cityInfo('Krems'), website: 'https://oeh.imc.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Piaristengasse 1, 3500 Krems', postal_code: '3500' },
  { name: 'OeH MCI Innsbruck', subtype: 'oeh_fh', city: 'Innsbruck', ...cityInfo('Innsbruck'), website: 'https://oeh.mci.edu/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Universitaetsstrasse 15, 6020 Innsbruck', postal_code: '6020' },
  { name: 'OeH FH Wiener Neustadt', subtype: 'oeh_fh', city: 'Wiener Neustadt', ...cityInfo('Wiener Neustadt'), website: 'https://oeh.fhwn.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Johannes-Gutenberg-Strasse 3, 2700 Wiener Neustadt', postal_code: '2700' },
  { name: 'OeH FH Burgenland', subtype: 'oeh_fh', city: 'Eisenstadt', ...cityInfo('Eisenstadt'), website: 'https://oeh.fh-burgenland.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Campus 1, 7000 Eisenstadt', postal_code: '7000' },
  { name: 'OeH FH Campus 02 Graz', subtype: 'oeh_fh', city: 'Graz', ...cityInfo('Graz'), website: 'https://oeh.campus02.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Koerblergasse 126, 8010 Graz', postal_code: '8010' },
  { name: 'OeH FH Gesundheitsberufe Tirol', subtype: 'oeh_fh', city: 'Innsbruck', ...cityInfo('Innsbruck'), website: 'https://oeh.fhg-tirol.ac.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'oeh', address: 'Innrain 98, 6020 Innsbruck', postal_code: '6020' },

  // OeH Bundesvertretung (national)
  { name: 'OeH Bundesvertretung', subtype: 'oeh_national', city: 'Wien', ...cityInfo('Wien'), website: 'https://www.oeh.ac.at/', facebook_url: 'https://www.facebook.com/bundesoeh', instagram_url: 'https://www.instagram.com/oeh_at/', event_feed_url: 'https://www.oeh.ac.at/veranstaltungen', registry_source: 'oeh', address: 'Taubstummengasse 7-9, 1040 Wien', postal_code: '1040' },
];

// ---------------------------------------------------------------------------
// ESN sections (Erasmus Student Network Austria)
// ---------------------------------------------------------------------------

const ESN_SECTIONS: StudentOrgEntry[] = [
  // Vienna
  { name: 'ESN Uni Wien', subtype: 'esn_section', city: 'Wien', ...cityInfo('Wien'), website: 'https://esnuniwien.com/', facebook_url: 'https://www.facebook.com/ESNUniWien', instagram_url: 'https://www.instagram.com/esnuniwien/', event_feed_url: 'https://esnuniwien.com/events', registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN Buddynetwork TU Wien', subtype: 'esn_section', city: 'Wien', ...cityInfo('Wien'), website: 'https://buddynetwork.at/', facebook_url: 'https://www.facebook.com/BuddynetworkTUWien', instagram_url: 'https://www.instagram.com/buddynetwork_tuwien/', event_feed_url: 'https://buddynetwork.at/events', registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN BOKU Wien', subtype: 'esn_section', city: 'Wien', ...cityInfo('Wien'), website: 'https://boku.esnaustria.org/', facebook_url: 'https://www.facebook.com/ESNBOKUWien', instagram_url: 'https://www.instagram.com/esn_boku_wien/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN BFI Vienna', subtype: 'esn_section', city: 'Wien', ...cityInfo('Wien'), website: 'https://bfivienna.esnaustria.org/', facebook_url: null, instagram_url: 'https://www.instagram.com/esn_bfi_vienna/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN FH Wien WKW', subtype: 'esn_section', city: 'Wien', ...cityInfo('Wien'), website: 'https://fhwien-wkw.esnaustria.org/', facebook_url: null, instagram_url: 'https://www.instagram.com/esn_fhwien/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN Technikum Wien', subtype: 'esn_section', city: 'Wien', ...cityInfo('Wien'), website: 'https://technikum.esnaustria.org/', facebook_url: null, instagram_url: 'https://www.instagram.com/esn_technikum_wien/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },

  // Graz
  { name: 'ESN Uni Graz', subtype: 'esn_section', city: 'Graz', ...cityInfo('Graz'), website: 'https://graz.esnaustria.org/', facebook_url: 'https://www.facebook.com/ESNUniGraz', instagram_url: 'https://www.instagram.com/esn_unigraz/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN TU Graz', subtype: 'esn_section', city: 'Graz', ...cityInfo('Graz'), website: 'https://esn.htu.tugraz.at/', facebook_url: 'https://www.facebook.com/ESNTUGraz', instagram_url: 'https://www.instagram.com/esn_tugraz/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },

  // Other cities
  { name: 'ESN Innsbruck', subtype: 'esn_section', city: 'Innsbruck', ...cityInfo('Innsbruck'), website: 'https://innsbruck.esnaustria.org/', facebook_url: 'https://www.facebook.com/ESNInnsbruck', instagram_url: 'https://www.instagram.com/esn_innsbruck/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN Kufstein', subtype: 'esn_section', city: 'Kufstein', ...cityInfo('Kufstein'), website: 'https://kufstein.esnaustria.org/', facebook_url: null, instagram_url: 'https://www.instagram.com/esn_kufstein/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN Klagenfurt', subtype: 'esn_section', city: 'Klagenfurt', ...cityInfo('Klagenfurt'), website: 'https://klagenfurt.esnaustria.org/', facebook_url: 'https://www.facebook.com/ESNKlagenfurt', instagram_url: 'https://www.instagram.com/esn_klagenfurt/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN Linz', subtype: 'esn_section', city: 'Linz', ...cityInfo('Linz'), website: 'https://linz.esnaustria.org/', facebook_url: 'https://www.facebook.com/ESNLinz', instagram_url: 'https://www.instagram.com/esn_linz/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN Salzburg', subtype: 'esn_section', city: 'Salzburg', ...cityInfo('Salzburg'), website: 'https://salzburg.esnaustria.org/', facebook_url: 'https://www.facebook.com/ESNSalzburg', instagram_url: 'https://www.instagram.com/esn_salzburg/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN St. Poelten', subtype: 'esn_section', city: 'St. Poelten', ...cityInfo('St. Poelten'), website: 'https://stpoelten.esnaustria.org/', facebook_url: null, instagram_url: 'https://www.instagram.com/esn_stpoelten/', event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },
  { name: 'ESN Leoben', subtype: 'esn_candidate', city: 'Leoben', ...cityInfo('Leoben'), website: null, facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'esn', address: null, postal_code: null },

  // ESN Austria national
  { name: 'ESN Austria', subtype: 'esn_national', city: 'Wien', ...cityInfo('Wien'), website: 'https://esnaustria.org/', facebook_url: 'https://www.facebook.com/ESNAustria', instagram_url: 'https://www.instagram.com/esnaustria/', event_feed_url: 'https://esnaustria.org/events/', registry_source: 'esn', address: null, postal_code: null },
];

// ---------------------------------------------------------------------------
// IAESTE sections (International Association for the Exchange of Students
// for Technical Experience)
// ---------------------------------------------------------------------------

const IAESTE_SECTIONS: StudentOrgEntry[] = [
  { name: 'IAESTE Austria', subtype: 'iaeste_national', city: 'Wien', ...cityInfo('Wien'), website: 'https://www.iaeste.at/', facebook_url: 'https://www.facebook.com/iaesteaustria', instagram_url: 'https://www.instagram.com/iaeste_austria/', event_feed_url: 'https://www.iaeste.at/events/', registry_source: 'iaeste', address: 'Paniglgasse 16/1, 1040 Wien', postal_code: '1040' },
  { name: 'IAESTE LC Wien', subtype: 'iaeste_lc', city: 'Wien', ...cityInfo('Wien'), website: 'https://wien.iaeste.at/', facebook_url: 'https://www.facebook.com/iaeste.wien', instagram_url: 'https://www.instagram.com/iaeste_vienna/', event_feed_url: null, registry_source: 'iaeste', address: null, postal_code: null },
  { name: 'IAESTE LC BOKU', subtype: 'iaeste_lc', city: 'Wien', ...cityInfo('Wien'), website: 'https://boku.iaeste.at/', facebook_url: null, instagram_url: null, event_feed_url: null, registry_source: 'iaeste', address: null, postal_code: null },
  { name: 'IAESTE LC Graz', subtype: 'iaeste_lc', city: 'Graz', ...cityInfo('Graz'), website: 'https://graz.iaeste.at/', facebook_url: 'https://www.facebook.com/iaeste.graz', instagram_url: 'https://www.instagram.com/iaeste_graz/', event_feed_url: null, registry_source: 'iaeste', address: null, postal_code: null },
  { name: 'IAESTE LC Innsbruck', subtype: 'iaeste_lc', city: 'Innsbruck', ...cityInfo('Innsbruck'), website: 'https://innsbruck.iaeste.at/', facebook_url: null, instagram_url: 'https://www.instagram.com/iaeste_innsbruck/', event_feed_url: null, registry_source: 'iaeste', address: null, postal_code: null },
  { name: 'IAESTE LC Leoben', subtype: 'iaeste_lc', city: 'Leoben', ...cityInfo('Leoben'), website: 'https://leoben.iaeste.at/', facebook_url: 'https://www.facebook.com/iaeste.leoben', instagram_url: null, event_feed_url: null, registry_source: 'iaeste', address: null, postal_code: null },
  { name: 'IAESTE LC Linz', subtype: 'iaeste_lc', city: 'Linz', ...cityInfo('Linz'), website: 'https://linz.iaeste.at/', facebook_url: null, instagram_url: 'https://www.instagram.com/iaeste_linz/', event_feed_url: null, registry_source: 'iaeste', address: null, postal_code: null },
];

// ---------------------------------------------------------------------------
// AIESEC sections
// ---------------------------------------------------------------------------

const AIESEC_SECTIONS: StudentOrgEntry[] = [
  { name: 'AIESEC Austria', subtype: 'aiesec_national', city: 'Wien', ...cityInfo('Wien'), website: 'https://aiesec.at/', facebook_url: 'https://www.facebook.com/aiesecaustria', instagram_url: 'https://www.instagram.com/aiesecinaustria/', event_feed_url: null, registry_source: 'aiesec', address: 'Lassingleithnerplatz 2/3, 1020 Wien', postal_code: '1020' },
  { name: 'AIESEC Wien UV', subtype: 'aiesec_lc', city: 'Wien', ...cityInfo('Wien'), website: 'https://aiesec.at/uniwien/', facebook_url: null, instagram_url: 'https://www.instagram.com/aiesec_vienna_uv/', event_feed_url: null, registry_source: 'aiesec', address: null, postal_code: null },
  { name: 'AIESEC Wien WU', subtype: 'aiesec_lc', city: 'Wien', ...cityInfo('Wien'), website: 'https://aiesec.at/wuwien/', facebook_url: null, instagram_url: 'https://www.instagram.com/aiesec_vienna_wu/', event_feed_url: null, registry_source: 'aiesec', address: null, postal_code: null },
  { name: 'AIESEC Graz', subtype: 'aiesec_lc', city: 'Graz', ...cityInfo('Graz'), website: 'https://aiesec.at/graz/', facebook_url: 'https://www.facebook.com/aiesecgraz', instagram_url: 'https://www.instagram.com/aiesec_graz/', event_feed_url: null, registry_source: 'aiesec', address: 'Universitaetsplatz 1, 8010 Graz', postal_code: '8010' },
  { name: 'AIESEC Linz', subtype: 'aiesec_lc', city: 'Linz', ...cityInfo('Linz'), website: 'https://aiesec.at/linz/', facebook_url: null, instagram_url: 'https://www.instagram.com/aiesec_linz/', event_feed_url: null, registry_source: 'aiesec', address: null, postal_code: null },
  { name: 'AIESEC Innsbruck', subtype: 'aiesec_lc', city: 'Innsbruck', ...cityInfo('Innsbruck'), website: 'https://aiesec.at/lc-innsbruck/', facebook_url: null, instagram_url: 'https://www.instagram.com/aiesec_innsbruck/', event_feed_url: null, registry_source: 'aiesec', address: 'Universitaetsstrasse 15/2, 6020 Innsbruck', postal_code: '6020' },
  { name: 'AIESEC Salzburg', subtype: 'aiesec_lc', city: 'Salzburg', ...cityInfo('Salzburg'), website: 'https://aiesec.at/salzburg/', facebook_url: null, instagram_url: 'https://www.instagram.com/aiesec_salzburg/', event_feed_url: null, registry_source: 'aiesec', address: null, postal_code: null },
];

// ---------------------------------------------------------------------------
// AEGEE sections (Association des Etats Generaux des Etudiants de l'Europe)
// ---------------------------------------------------------------------------

const AEGEE_SECTIONS: StudentOrgEntry[] = [
  { name: 'AEGEE-Wien', subtype: 'aegee_antenna', city: 'Wien', ...cityInfo('Wien'), website: 'https://aegee-wien.org/', facebook_url: 'https://www.facebook.com/AegeeWien', instagram_url: 'https://www.instagram.com/aegee_wien/', event_feed_url: 'https://aegee-wien.org/events/', registry_source: 'aegee', address: null, postal_code: null },
  { name: 'AEGEE-Graz', subtype: 'aegee_contact', city: 'Graz', ...cityInfo('Graz'), website: null, facebook_url: 'https://www.facebook.com/AEGEEGraz', instagram_url: null, event_feed_url: null, registry_source: 'aegee', address: null, postal_code: null },
];

// ---------------------------------------------------------------------------
// Main import logic
// ---------------------------------------------------------------------------

async function importStudentOrgs(): Promise<void> {
  const allOrgs: StudentOrgEntry[] = [
    ...OEH_SECTIONS,
    ...ESN_SECTIONS,
    ...IAESTE_SECTIONS,
    ...AIESEC_SECTIONS,
    ...AEGEE_SECTIONS,
  ];

  console.log(`\n=== Student Organization Registry Import ===`);
  console.log(`Total orgs to import: ${allOrgs.length}`);
  console.log(`  OeH sections: ${OEH_SECTIONS.length}`);
  console.log(`  ESN sections: ${ESN_SECTIONS.length}`);
  console.log(`  IAESTE sections: ${IAESTE_SECTIONS.length}`);
  console.log(`  AIESEC sections: ${AIESEC_SECTIONS.length}`);
  console.log(`  AEGEE sections: ${AEGEE_SECTIONS.length}`);
  if (DRY_RUN) console.log(`  Mode: DRY RUN (no writes)`);
  console.log('');

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const org of allOrgs) {
    const nameNormalized = normalizeName(org.name);

    const venueData = {
      name: org.name,
      name_normalized: nameNormalized,
      type: 'student_org' as const,
      subtype: org.subtype,
      address: org.address,
      postal_code: org.postal_code,
      city: org.city,
      bundesland: org.bundesland,
      latitude: org.latitude,
      longitude: org.longitude,
      website: org.website,
      facebook_url: org.facebook_url,
      instagram_url: org.instagram_url,
      event_feed_url: org.event_feed_url,
      event_feed_type: null,
      osm_id: null,
      osm_tags: null,
      registry_source: org.registry_source,
      is_student_relevant: true,
      localness_score: org.subtype?.includes('national') ? 30 : 70,
      scrape_status: 'pending' as const,
    };

    if (DRY_RUN) {
      console.log(`  [DRY] Would upsert: ${org.name} (${org.city}, ${org.registry_source})`);
      inserted++;
      continue;
    }

    // Upsert: use name_normalized + city as the unique key
    // First check if it exists
    const { data: existing } = await supabase
      .from('venues')
      .select('id')
      .eq('name_normalized', nameNormalized)
      .eq('city', org.city)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('venues')
        .update({
          ...venueData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`  [ERROR] Update failed for ${org.name}: ${error.message}`);
        errors++;
      } else {
        console.log(`  [UPDATE] ${org.name} (${org.city})`);
        updated++;
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('venues')
        .insert(venueData);

      if (error) {
        console.error(`  [ERROR] Insert failed for ${org.name}: ${error.message}`);
        errors++;
      } else {
        console.log(`  [INSERT] ${org.name} (${org.city})`);
        inserted++;
      }
    }
  }

  console.log(`\n=== Import Summary ===`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total:    ${allOrgs.length}`);

  // Print breakdown by source and city
  const bySource: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const byBundesland: Record<string, number> = {};
  for (const org of allOrgs) {
    bySource[org.registry_source] = (bySource[org.registry_source] || 0) + 1;
    byCity[org.city] = (byCity[org.city] || 0) + 1;
    byBundesland[org.bundesland] = (byBundesland[org.bundesland] || 0) + 1;
  }

  console.log(`\nBy Source:`);
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nBy City:`);
  Object.entries(byCity).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nBy Bundesland:`);
  Object.entries(byBundesland).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

importStudentOrgs()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
