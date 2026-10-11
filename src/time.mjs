export const TIMEZONE = 'Europe/Helsinki';
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function localParts(value) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

export function addDays(date, amount) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

export function viewingTime(value) {
  const { date, hour, minute } = localParts(value);
  const midnight = hour === 0 && minute === 0;
  return {
    date, viewingDate: midnight ? addDays(date, -1) : date,
    time: midnight ? '24.00' : `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')}`,
    primetime: hour >= 12 || midnight,
  };
}

export function dateLabel(date) {
  return new Intl.DateTimeFormat('fi-FI', {
    timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function timestampLabel(value) {
  return new Intl.DateTimeFormat('fi-FI', {
    timeZone: TIMEZONE, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
