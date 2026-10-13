import { load } from 'cheerio';
import { request, unique } from '../http.mjs';
import { localParts, addDays } from '../time.mjs';
import { helsinkiInstant } from './viaplaytv.mjs';
import { isGameTitle } from '../teams.mjs';

export const RUUTU_URL = 'https://www.ruutu.fi/ohjelmat/nfl';
export function parseRuutu(html, { date, days }) {
  const $ = load(html);
  if (!$('h1').text().includes('NFL')) throw new Error('Ruudun NFL-sivun rakenne muuttui');
  const items = [];
  for (const element of $('a[href^="/stream/"]').toArray()) {
    const row = $(element);
    const title = row.find('[class*="titleText"]').text().trim();
    const time = row.find('[class*="__time"]');
    const clock = time.find('strong').text().match(/^(\d{2}):(\d{2})$/);
    const day = time.text().replace(time.find('strong').text(), '').match(/^(\d{1,2})\.(\d{1,2})\.$/);
    if (!title || !clock || !day) throw new Error('Ruudun suoran lähetyksen aika tai otsikko puuttuu');
    if (!isGameTitle(title, 'nfl')) continue; // RedZone is a multiplex, not a game.
    const year = Number(date.slice(0, 4));
    const candidates = [year - 1, year, year + 1].map(y => `${y}-${day[2].padStart(2, '0')}-${day[1].padStart(2, '0')}`);
    const eventDate = candidates.find(d => d >= addDays(date, -1) && d <= addDays(date, days));
    if (!eventDate) continue;
    const startTimeUTC = helsinkiInstant(eventDate, Number(clock[1]), Number(clock[2]));
    if (localParts(startTimeUTC).date !== eventDate) throw new Error('Ruudun päivämäärä on virheellinen');
    items.push({ league: 'nfl', title, startTimeUTC, channel: 'ruutu', live: true, language: row.find('img[alt]').toArray().some(e => /selostus suomi/i.test($(e).attr('alt'))) ? 'fi' : 'en', url: new URL(row.attr('href'), RUUTU_URL).href });
  }
  return { items: unique(items), url: RUUTU_URL };
}
export async function fetchRuutu(context) { return parseRuutu(await request(RUUTU_URL), context); }
