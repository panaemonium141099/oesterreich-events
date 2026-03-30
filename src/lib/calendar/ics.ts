/**
 * Generate .ics file content and Google Calendar URL for events.
 */

interface CalendarEventData {
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  location_name?: string | null;
  address?: string | null;
  source_url?: string | null;
}

function formatICSDate(dateStr: string): string {
  const d = new Date(dateStr);
  // Format as YYYYMMDDTHHMMSS in UTC
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function formatGoogleDate(dateStr: string): string {
  // Google Calendar uses YYYYMMDDTHHMMSSZ format
  return formatICSDate(dateStr);
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateICSContent(event: CalendarEventData): string {
  const now = formatICSDate(new Date().toISOString());
  const dtStart = formatICSDate(event.start_date);
  // If no end date, default to start + 2 hours
  const dtEnd = event.end_date
    ? formatICSDate(event.end_date)
    : formatICSDate(new Date(new Date(event.start_date).getTime() + 2 * 60 * 60 * 1000).toISOString());

  const location = [event.location_name, event.address].filter(Boolean).join(', ');
  const description = [event.description, event.source_url ? `\n\nMehr Info: ${event.source_url}` : '']
    .filter(Boolean)
    .join('');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OesterreichEvents//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Vienna',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `DTSTAMP:${now}`,
    `UID:${crypto.randomUUID()}@oesterreich-events`,
    `SUMMARY:${escapeICS(event.title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICS(description)}`);
  }
  if (location) {
    lines.push(`LOCATION:${escapeICS(location)}`);
  }
  if (event.source_url) {
    lines.push(`URL:${event.source_url}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(event: CalendarEventData): void {
  const content = generateICSContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, '').replace(/\s+/g, '-').substring(0, 50)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getGoogleCalendarUrl(event: CalendarEventData): string {
  const dtStart = formatGoogleDate(event.start_date);
  const dtEnd = event.end_date
    ? formatGoogleDate(event.end_date)
    : formatGoogleDate(new Date(new Date(event.start_date).getTime() + 2 * 60 * 60 * 1000).toISOString());

  const location = [event.location_name, event.address].filter(Boolean).join(', ');
  const description = [event.description, event.source_url ? `\nMehr Info: ${event.source_url}` : '']
    .filter(Boolean)
    .join('');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${dtStart}/${dtEnd}`,
  });

  if (location) params.set('location', location);
  if (description) params.set('details', description);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
