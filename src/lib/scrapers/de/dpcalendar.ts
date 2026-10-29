/**
 * DPCalendar (Joomla), fn-29.7.
 *
 * Gelesen wird `index.php?option=com_dpcalendar&task=ical.download&id=<Kalender>`.
 * Der Export ist oft der Spiegel eines Google-Kalenders: ganzer Bestand seit
 * Jahren (Bramstedtlund 2026-10-29: 411 Termine ab 2017), Zeiten mit `TZID`
 * oder in UTC (`Z`), ganztägig als `VALUE=DATE`, Wiederholungen als `RRULE`
 * mit `EXDATE` und geänderten Einzelterminen (`RECURRENCE-ID`). Aufgelöst
 * werden sie mit node-ical (`expandRecurringEvent`) im Zeitfenster.
 * REIN bis auf node-ical, kein I/O.
 */
import * as ical from 'node-ical';
import type { VEvent } from 'node-ical';
import { decodeEntities } from '@/lib/utils/decode-entities';

export interface DpEvent {
  uid: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  category?: string;
}

const BERLIN_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** ParameterValue von node-ical („string" oder `{ val, params }`) als Text. */
function text(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v : v && typeof v === 'object' && 'val' in v ? String((v as { val: unknown }).val) : undefined;
  const t = s ? decodeEntities(s).replace(/[ \t]+/g, ' ').trim() : '';
  return t || undefined;
}

/**
 * Ganztägig: node-ical legt das Datum auf lokale Mitternacht des Prozesses.
 * Zwölf Stunden später ist in jeder Zone zwischen UTC−12 und UTC+12 noch
 * derselbe UTC-Kalendertag, ohne Datums-Getter der Laufzeitzone.
 */
const localDay = (d: Date) => new Date(d.getTime() + 12 * 3_600_000).toISOString().slice(0, 10);

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * `TZID=UTC` schreibt DPCalendar, wenn die Website auf Zeitzone UTC steht;
 * gemeint ist die Ortszeit (Weimar (Lahn) „Angst im Dunkeln" 20:00 UTC,
 * Seite 20:00; ebenso Mehlbek, Birgel, Oersdorf, Poyenberg, 2026-10-29).
 * Echte UTC-Zeiten (`Z`, Google-Spiegel Bramstedtlund) bleiben UTC.
 */
export function wallTimeForUtcTzid(icsText: string): string {
  return icsText.replace(/;TZID=(?:"UTC"|UTC|Etc\/UTC|GMT):/g, ';TZID=Europe/Berlin:');
}

export function parseDpIcs(icsText: string, from: Date, to: Date): DpEvent[] {
  const data = ical.sync.parseICS(wallTimeForUtcTzid(icsText));
  const out: DpEvent[] = [];
  for (const c of Object.values(data)) {
    if (!c || c.type !== 'VEVENT') continue;
    const ev = c as VEvent;
    // Geänderte Einzeltermine hängen am Grundtermin (recurrences) und kommen über ihn.
    if ((ev as { recurrenceid?: unknown }).recurrenceid) continue;
    let instances;
    try {
      instances = ical.expandRecurringEvent(ev, { from, to });
    } catch {
      continue;
    }
    for (const inst of instances) {
      const e = inst.event;
      const title = text(e.summary ?? inst.summary);
      if (!title || /^CANCELLED$/i.test(String(e.status ?? ''))) continue;
      const s = new Date(inst.start);
      const en = inst.end ? new Date(inst.end) : undefined;
      let start: string, end: string | undefined, localDate: string;
      if (inst.isFullDay) {
        localDate = localDay(s);
        start = localDate;
        // DTEND;VALUE=DATE ist ausschließlich.
        const last = en ? addDays(localDay(en), -1) : undefined;
        end = last && last > localDate ? last : undefined;
      } else {
        localDate = BERLIN_DAY.format(s);
        start = s.toISOString();
        end = en && en > s ? en.toISOString() : undefined;
      }
      out.push({
        uid: String(e.uid ?? ''),
        localDate,
        start,
        end,
        allDay: inst.isFullDay,
        title,
        description: text(e.description),
        location: text(e.location),
        url: text((e as { url?: unknown }).url),
        category: Array.isArray(e.categories) ? text(e.categories[0]) : undefined,
      });
    }
  }
  return out.filter(e => e.uid);
}
