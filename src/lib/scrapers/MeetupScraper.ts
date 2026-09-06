/**
 * Meetup — Community-Events in Österreich über die öffentlichen Suchseiten.
 *
 * Meetups GraphQL-API verlangt OAuth 2.0; wir scrapen deshalb die
 * öffentlichen Suchergebnisse für österreichische Städte.
 *
 * ACHTUNG — was dieser Adapter NICHT darf (gemessen am Prod-Bestand
 * 2026-09-06, alle 19 künftigen meetup.com-Events waren betroffen):
 *
 *  1. Die **Suchstadt als Veranstaltungsort** übernehmen. Meetups
 *     Suchseiten liefern global gemischte Ergebnisse. Weil der Adapter
 *     `bundesland: guessBundesland(...) || defaultBundesland` setzte und
 *     Klagenfurt die letzte Stadt der Schleife war, stand am Ende
 *     "Chandler Local Singles Speed Dating" (Arizona) und "Chicago Data
 *     Night" mit `bundesland='kaernten'` und `country='AT'` publik auf
 *     der Seite. Die Suchregion ist Discovery-Kontext, kein Ortsbeleg.
 *
 *  2. Fehlende Ortsnamen mit **"Österreich"** auffüllen. In
 *     `location_master_coords` existierte ein Master-Eintrag für den
 *     normalisierten Namen "österreich" (→ 48.3069/14.2858, Linz); der
 *     DB-Trigger `trg_apply_master_coords` verpasste damit jedem so
 *     befüllten US-Event einen Linzer Kartenpin.
 *
 *  3. Die **Event-ID aus dem Titel** ableiten. `meetup-${slug(title)}`
 *     auf 60 Zeichen gekürzt kollidiert für jede wiederkehrende
 *     Veranstaltung: zwei Termine derselben Reihe teilten sich eine
 *     source_id und überschrieben einander. Meetup-URLs tragen eine
 *     echte numerische Event-ID — die ist die Identität.
 *
 *  4. Zeitstempel auf 19 Zeichen **kürzen**. `slice(0, 19)` warf den
 *     UTC-Offset weg, ein Event um 18:00 Ortszeit wurde als naive
 *     18:00 gespeichert und je nach Zeitzone falsch angezeigt.
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../connectors/json-ld-connector';

// Bundesland-Zuordnung NUR über einen im Event selbst genannten Ortsnamen.
const CITY_BUNDESLAND: Record<string, string> = {
  'wien': 'Wien', 'vienna': 'Wien',
  'graz': 'Steiermark',
  'linz': 'Oberösterreich',
  'salzburg': 'Salzburg',
  'innsbruck': 'Tirol',
  'klagenfurt': 'Kärnten',
  'villach': 'Kärnten',
  'bregenz': 'Vorarlberg',
  'dornbirn': 'Vorarlberg',
  'eisenstadt': 'Burgenland',
  'st. pölten': 'Niederösterreich',
  'wels': 'Oberösterreich',
  'wiener neustadt': 'Niederösterreich',
  'krems': 'Niederösterreich',
};

/**
 * Bundesland aus dem Ortsnamen DES EVENTS. Liefert `undefined`, wenn der
 * Ortsname keine bekannte österreichische Stadt nennt — bewusst ohne
 * Fallback: lieber kein Bundesland als das der Suchanfrage.
 */
function bundeslandFromEventLocation(location: string | undefined): string | undefined {
  if (!location) return undefined;
  const lower = location.toLowerCase();
  for (const [key, val] of Object.entries(CITY_BUNDESLAND)) {
    if (lower.includes(key)) return val;
  }
  return undefined;
}

/**
 * Ist die Adresse aus dem JSON-LD in Österreich?
 *
 * `addressCountry` ist bei Meetup entweder ein ISO-Code ("at", "us") oder
 * ein Objekt `{ name: "..." }`. Ohne Länderangabe: `null` = unbekannt.
 * Der Aufrufer wirft unbekannte UND nicht-österreichische Events weg —
 * eine Plattform für österreichische Events importiert keine Events, von
 * denen sie nicht weiss, wo sie stattfinden.
 */
function addressCountryCode(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null;
  const raw = (address as Record<string, unknown>).addressCountry;
  const value =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object'
        ? String((raw as Record<string, unknown>).name ?? '')
        : '';
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'at' || v === 'aut' || v === 'austria' || v === 'österreich') return 'AT';
  return v.slice(0, 2).toUpperCase();
}

/**
 * Stabile Event-ID aus der Meetup-URL: `/<group>/events/<numericId>/`.
 * Ohne verwertbare URL gibt es keine Identität — und damit kein Event.
 */
export function meetupEventIdFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/meetup\.com\/([^/]+)\/events\/(\d+)/i);
  if (m) return `${m[1]}-${m[2]}`;
  // Manche Detailseiten tragen die ID ohne Gruppensegment.
  const bare = url.match(/\/events\/(\d{6,})/);
  return bare ? bare[1] : null;
}

function guessCategory(title: string, groupName: string, description?: string): string {
  const text = `${title} ${groupName} ${description || ''}`.toLowerCase();

  if (/tech|code|coding|programm|developer|software|data|ai |machine learning|devops|cloud|cyber|hack/.test(text)) return 'Bildung';
  if (/business|startup|entrepreneur|network|career|profession/.test(text)) return 'Wirtschaft';
  if (/yoga|fitness|sport|run |hiking|outdoor|climb|swim/.test(text)) return 'Sport';
  if (/musik|music|concert|jam|band/.test(text)) return 'Musik';
  if (/kunst|art|gallery|photo|paint|design|creative/.test(text)) return 'Kultur';
  if (/sprach|language|english|deutsch|spanish|french|conversation/.test(text)) return 'Bildung';
  if (/cook|food|kulinar|wine|wein|dinner|brunch/.test(text)) return 'Wein & Kulinarik';
  if (/natur|nature|garden|green|environ/.test(text)) return 'Natur';
  if (/family|famili|kinder|kids|parent/.test(text)) return 'Familie';

  return 'Sonstiges';
}

function guessTags(title: string, groupName: string): string[] {
  const text = `${title} ${groupName}`.toLowerCase();
  const tags: string[] = ['Meetup'];

  if (/tech|code|programm|developer|software/.test(text)) tags.push('Tech');
  if (/startup|entrepreneur/.test(text)) tags.push('Startup');
  if (/language|sprach/.test(text)) tags.push('Sprache');
  if (/network|professional/.test(text)) tags.push('Networking');
  if (/workshop/.test(text)) tags.push('Workshop');
  if (/hiking|outdoor|wander/.test(text)) tags.push('Outdoor');

  return tags;
}

export class MeetupScraper extends BaseScraper {
  readonly name = 'meetup.com';
  private readonly BASE = 'https://www.meetup.com';

  // Suchstädte — reiner Discovery-Kontext. Weder Ort noch Bundesland
  // eines Ergebnisses werden daraus abgeleitet.
  private readonly CITIES: string[] = [
    'Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt',
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Meetup Scraping (öffentliche Seiten)...');
    const events: ScrapedEvent[] = [];
    let skippedNoId = 0;
    let skippedForeign = 0;

    for (const city of this.CITIES) {
      const urls = [
        `${this.BASE}/find/?location=${encodeURIComponent(city)}%2C+Austria&source=EVENTS`,
        `${this.BASE}/find/events/?allMeetups=true&radius=50&userFreeform=${encodeURIComponent(city)}%2C+Austria`,
        `${this.BASE}/cities/at/${city.toLowerCase()}/events/`,
      ];

      for (const url of urls) {
        try {
          const html = await this.fetchPage(url);
          const $ = cheerio.load(html);
          const parsed = this.parsePage($, url);
          events.push(...parsed.events);
          skippedNoId += parsed.skippedNoId;
          skippedForeign += parsed.skippedForeign;
          this.log(`${city}: ${parsed.events.length} Events von ${url}`);
          if (parsed.events.length > 0) break;
          await this.rateLimit();
        } catch (err) {
          this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
        }
      }
      await this.rateLimit();
    }

    // Deduplizieren über die ECHTE Event-ID. Anders als bisher kollidieren
    // gleichnamige Termine derselben Reihe damit nicht mehr.
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) seen.set(ev.source_id, ev);
    this.log(
      `Gesamt: ${seen.size} Meetup-Events ` +
        `(${skippedNoId} ohne Event-ID verworfen, ${skippedForeign} ausserhalb Österreichs verworfen)`,
    );
    return Array.from(seen.values());
  }

  private parsePage(
    $: ReturnType<typeof cheerio.load>,
    pageUrl: string,
  ): { events: ScrapedEvent[]; skippedNoId: number; skippedForeign: number } {
    const events: ScrapedEvent[] = [];
    let skippedNoId = 0;
    let skippedForeign = 0;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || !isEventType(item['@type'])) continue;
          const name = String(item.name || '').trim();
          if (!name) continue;

          // Identität: echte Event-ID aus der Meetup-URL. Kein Titel-Slug.
          const eventUrl = String(item.url || '');
          const eventId = meetupEventIdFromUrl(eventUrl);
          if (!eventId) { skippedNoId++; continue; }

          // Zeitstempel unverändert übernehmen — inklusive UTC-Offset.
          const startDate = String(item.startDate || '').trim();
          if (!startDate) continue;
          const endDate = item.endDate ? String(item.endDate).trim() : undefined;

          const location = item.location as Record<string, unknown> | undefined;
          const locName = location ? String(location.name || '').trim() : '';
          const address = location?.address;
          const country = addressCountryCode(address);

          // Nur belegte AT-Events. Ohne Länderangabe wird nichts angenommen:
          // die Suchregion beweist nichts über den Veranstaltungsort.
          if (country !== 'AT') { skippedForeign++; continue; }

          const addr = address as Record<string, unknown> | undefined;
          const street = addr?.streetAddress ? String(addr.streetAddress).trim() : undefined;
          const locality = addr?.addressLocality ? String(addr.addressLocality).trim() : undefined;
          const postalCode = addr?.postalCode ? String(addr.postalCode).trim() : undefined;

          const geo = location?.geo as Record<string, unknown> | undefined;
          const organizer = item.organizer as Record<string, unknown> | undefined;
          const groupName = organizer ? String(organizer.name || '') : '';

          events.push({
            source_id: `meetup-${eventId}`,
            source_name: this.name,
            source_url: eventUrl || pageUrl,
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: endDate,
            // Kein "Österreich"-Platzhalter: ohne Venue-Namen fällt der
            // Ortsname auf die Stadt der Event-Adresse zurück, sonst bleibt
            // er leer und der Freigabevertrag hält das Event zurück.
            location_name: locName || locality || undefined,
            address: street,
            postal_code: postalCode,
            country: 'AT',
            // Bundesland ausschliesslich aus dem Ort DES EVENTS.
            bundesland: bundeslandFromEventLocation(locName || locality),
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: guessCategory(name, groupName, item.description ? String(item.description) : undefined),
            tags: guessTags(name, groupName),
            organizer: groupName || undefined,
            image_url: item.image ? String(Array.isArray(item.image) ? item.image[0] : item.image) : undefined,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return { events, skippedNoId, skippedForeign };

    // HTML-Fallback — Meetup-Eventkarten. Die Karten tragen weder
    // Länderangabe noch Adresse, deshalb entsteht hier bewusst KEIN
    // Bundesland und kein Ortsplatzhalter. Ohne Event-ID in der href
    // wird die Karte übersprungen.
    $('[class*="eventCard"], [class*="event-card"], [data-testid*="event"], .event-listing, article').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, [class*="title"], [class*="name"], a').first().text().trim();
      if (!title || title.length < 3 || title.length > 200) return;
      if (['Home', 'Kontakt', 'Sign up', 'Log in'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : '';
      const eventId = meetupEventIdFromUrl(sourceUrl);
      if (!eventId) { skippedNoId++; return; }

      const dateEl = $el.find('time, [datetime], [class*="date"], [class*="time"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const groupName = $el.find('[class*="group"], [class*="organizer"]').first().text().trim();
      const location = $el.find('[class*="location"], [class*="venue"]').first().text().trim();

      const desc = $el.find('[class*="description"], p').first().text().trim().slice(0, 500) || undefined;
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc && !imgSrc.includes('avatar') ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      events.push({
        source_id: `meetup-${eventId}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: location || undefined,
        bundesland: bundeslandFromEventLocation(location),
        category: guessCategory(title, groupName, desc),
        tags: guessTags(title, groupName),
        organizer: groupName || undefined,
        image_url: imageUrl,
      });
    });

    return { events, skippedNoId, skippedForeign };
  }

  /**
   * Reines Kalenderdatum aus einem Kartentext. Bewusst OHNE erfundene
   * Uhrzeit — ein bekanntes Datum ohne Zeit ist gültige Information,
   * "00:00" wäre eine Behauptung.
   */
  private parseDate(text: string): string | null {
    if (!text) return null;
    // Vollständiger ISO-Zeitstempel im datetime-Attribut: unverändert
    // übernehmen, damit der Offset erhalten bleibt.
    const isoFull = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?/);
    if (isoFull) return isoFull[0];
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // "Mon DD, YYYY"
    const mdy = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i);
    if (mdy) {
      const months: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
      };
      const m = months[mdy[1].toLowerCase().slice(0, 3)];
      if (m) return `${mdy[3]}-${m}-${mdy[2].padStart(2, '0')}`;
    }
    return null;
  }
}
