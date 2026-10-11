import { load } from 'cheerio';
import { request, mapLimit, unique } from '../http.mjs';
import { isGameTitle } from '../teams.mjs';
import { addDays } from '../time.mjs';
import { readFile } from 'node:fs/promises';

export const STAR_URL = 'https://www.starchannel.fi/ohjelmaopas/star';
export function parseStar(html, url = STAR_URL) {
  const $ = load(html);
  const events = $('.acilia-schedule-event');
  if (!events.length) throw new Error('Starin ohjelmaoppaan rakenne muuttui tai opas on tyhjä');
  const items = [];
  events.each((_, element) => {
    const row = $(element);
    const title = (row.find('.description h4').first().text() || row.find('h3').first().text()).replace(/\s+/g, ' ').trim();
    const description = row.find('.description p').text();
    const timestamp = Number(row.attr('data-datetime-timestamp')) * 1000;
    if (!Number.isFinite(timestamp) || !timestamp) throw new Error('Starin lähetysajankohta puuttuu');
    if (isGameTitle(title) && /NHL/i.test(title) && !/uusinta|replay/i.test(description)) {
      items.push({ title, startTimeUTC: new Date(timestamp).toISOString(), channel: 'star', live: true, url });
    }
  });
  const dates = events.toArray().map(e => $(e).attr('data-datetime-date')).filter(Boolean).sort();
  return { items: unique(items), coverageThrough: dates.at(-1), url };
}

export async function fetchStar({ date, days }) {
  // Star omits its Sectigo intermediate. Its signature is checked against Node's
  // trusted roots before use; the server certificate and hostname remain verified.
  const intermediate = await readFile(new URL('../certificates/sectigo-ov-r36.pem', import.meta.url), 'utf8');
  // Each page includes the preceding week and a few days after its selected date.
  const dates = Array.from({ length: Math.ceil(days / 7) }, (_, i) => addDays(date, 7 + i * 7));
  const pages = await mapLimit(dates, 2, async d => {
    const url = `${STAR_URL}/${d.replaceAll('-', '')}`;
    return parseStar(await request(url, { intermediateCertificates: [intermediate] }), url);
  });
  return { items: unique(pages.flatMap(p => p.items)), coverageThrough: pages.map(p => p.coverageThrough).sort().at(-1), url: STAR_URL };
}
