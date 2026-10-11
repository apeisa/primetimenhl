import { load } from 'cheerio';
import { request, mapLimit, unique } from '../http.mjs';
import { addDays, localParts } from '../time.mjs';
import { isGameTitle } from '../teams.mjs';

export const VIAPLAYTV_URL = 'https://viaplaytv.fi/ohjelmatiedot/';

// Convert a wall-clock time using Helsinki's actual offset, including DST.
export function helsinkiInstant(date, hour, minute) {
  const target = Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const local = localParts(instant);
    const wall = Date.parse(`${local.date}T${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}:00Z`);
    instant += target - wall;
  }
  return new Date(instant).toISOString();
}

export function parseViaplayTv(html, date, url = VIAPLAYTV_URL) {
  const $ = load(html);
  const rows = $('.programslide');
  if (!rows.length) throw new Error('Viaplay TV:n ohjelmaoppaan rakenne muuttui tai opas on tyhjä');
  const items = [];
  let day = date, previous = -1;
  rows.each((_, element) => {
    const row = $(element);
    const title = row.find('h5').text().trim();
    const match = row.find('.time').text().match(/(\d{1,2}):(\d{2})/);
    if (!match) throw new Error('Viaplay TV:n lähetysaika puuttuu');
    const hour = Number(match[1]), minute = Number(match[2]);
    const total = hour * 60 + minute;
    if (total < previous) day = addDays(day, 1);
    previous = total;
    if (row.find('.live-tag').length && /NHL/i.test(title) && isGameTitle(title)) {
      items.push({ title, startTimeUTC: helsinkiInstant(day, hour, minute), channel: 'viaplaytv', live: true, url });
    }
  });
  const links = $('.date-tab').toArray().map(e => ({
    date: $(e).attr('data-date'), url: new URL($(e).attr('href'), VIAPLAYTV_URL).href,
  })).filter(x => x.date);
  return { items, links, url };
}

export async function fetchViaplayTv({ date, days }) {
  const url = `${VIAPLAYTV_URL}?date=${date}`;
  const first = parseViaplayTv(await request(url), date, url);
  const links = first.links.filter(link => link.date > date && link.date < addDays(date, days));
  const pages = await mapLimit(links, 3, async link => parseViaplayTv(await request(link.url), link.date, link.url));
  return {
    items: unique([first, ...pages].flatMap(p => p.items)),
    coverageThrough: [date, ...links.map(l => l.date)].sort().at(-1), url: VIAPLAYTV_URL,
  };
}
