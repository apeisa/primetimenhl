const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function parts(value) {
  const p = Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}
function shift(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Late evening starts stay visible until 02:00 Helsinki time the next morning.
// Exactly 00:00 belongs to the previous evening (displayed as 24.00).
export function isWithinViewingWindow(start, now) {
  if (Date.parse(start) > new Date(now).getTime()) return true;
  const game = parts(start), current = parts(now);
  const midnight = game.hour === 0 && game.minute === 0;
  if (game.hour < 22 && !midnight) return false;
  const evening = midnight ? shift(game.date, -1) : game.date;
  return (current.date === evening && current.hour >= 22)
    || (current.date === shift(evening, 1) && current.hour < 2);
}
