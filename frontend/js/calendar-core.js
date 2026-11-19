import {escapeHtml as e} from './directory-core.js';

// Deadline reminders for government notices and hackathons: an all-day event on the deadline, as a Google
// Calendar link (works without scripts) or an iCalendar file (Apple Calendar, Outlook) with two reminders.

/** The deadline's calendar date: a yyyy-mm-dd date as given, or a timestamp's date in India. A deadline
 *  at midnight closes the day before, so one minute is taken off first. */
export function deadlineDay(value) {
  const text = String(value ?? '').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const time = Date.parse(text);
  if(!text || !Number.isFinite(time)) return '';
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(time - 60000));
}
const compact = day => day.replace(/-/g, '');
const nextDay = day => new Date(Date.parse(day + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
const icsText = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = line => { const out = []; let rest = line; while(rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); } out.push(rest); return out.join('\r\n'); };
const safeUrl = value => /^https:\/\//i.test(String(value || '')) ? String(value) : '';

export function deadlineIcs({id = '', title, deadline, url = '', note = ''}, now = Date.now()) {
  const day = deadlineDay(deadline), link = safeUrl(url);
  if(!day || !String(title || '').trim()) return null;
  const uid = String(id || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'deadline';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WILSY//Deadlines//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:deadline-${uid}-${compact(day)}@wilsy.in`, `DTSTAMP:${new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${compact(day)}`, `DTEND;VALUE=DATE:${compact(nextDay(day))}`,
    `SUMMARY:${icsText('Deadline: ' + String(title).trim())}`, ...(link ? [`URL:${icsText(link)}`] : []),
    `DESCRIPTION:${icsText([note, link && 'Official details: ' + link, 'Always confirm the date on the official page.'].filter(Boolean).join('\n'))}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Deadline in two days', 'TRIGGER:-P2D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Deadline today', 'TRIGGER:PT9H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl({title, deadline, url = '', note = ''}) {
  const day = deadlineDay(deadline);
  if(!day || !String(title || '').trim()) return '';
  return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({action: 'TEMPLATE', text: 'Deadline: ' + String(title).trim(),
    dates: `${compact(day)}/${compact(nextDay(day))}`, details: [note, safeUrl(url)].filter(Boolean).join('\n')});
}

/** "Add the deadline to your calendar" links; empty when there is no usable date. features.js handles the file. */
export function calendarActions(item, {label = 'Add the deadline to your calendar'} = {}) {
  const google = googleCalendarUrl(item);
  if(!google) return '';
  const data = JSON.stringify({id: item.id || '', title: item.title, deadline: deadlineDay(item.deadline), url: safeUrl(item.url), note: item.note || ''});
  return `<div class="cal-actions" role="group" aria-label="${e(label)}"><span class="cal-label">Remind me</span><a href="${e(google)}" target="_blank" rel="noopener noreferrer">Google Calendar</a><button type="button" data-ics="${e(data)}">Apple / Outlook (.ics)</button></div>`;
}
