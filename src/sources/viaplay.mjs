import { load } from 'cheerio';
import { request, mapLimit, unique } from '../http.mjs';
import { addDays } from '../time.mjs';
import { isGameTitle } from '../teams.mjs';

export const VIAPLAY_URL = 'https://viaplay.fi/urheilu/jaakiekko/nhl';
const API_URL = 'https://content.viaplay.fi/pcdash-fi/urheilu/jaakiekko/nhl';

export function parseViaplay(raw) {
  if (!raw._embedded || (raw.responseCode?.httpStatus ?? raw.responseCode) !== 200) throw new Error('Viaplayn ohjelmarajapinnan rakenne muuttui');
  const items = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'sport' && value.content?.format?.title === 'NHL'
        && value.system?.flags?.includes('liveStream') && value.recording?.airingType === 'live'
        && isGameTitle(value.content.title) && Number.isFinite(Date.parse(value.epg?.start))) {
      items.push({
        title: value.content.title, startTimeUTC: new Date(value.epg.start).toISOString(),
        channel: 'viaplay', live: true,
        url: value.publicPath ? `https://viaplay.fi/urheilu/${value.publicPath}` : VIAPLAY_URL,
      });
    }
    for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child);
  }
  walk(raw._embedded);
  return { items: unique(items), links: raw._links?.['viaplay:days'] ?? [] };
}

export async function fetchViaplay({ date, days }) {
  const first = parseViaplay(JSON.parse(await request(`${API_URL}?date=${date}`)));
  const links = first.links.filter(link => link.date > date && link.date < addDays(date, days));
  const pages = await mapLimit(links, 3, async link => {
    // Only follow the provider's public content API, never arbitrary source URLs.
    if (new URL(link.href).hostname !== 'content.viaplay.fi') throw new Error('Tuntematon Viaplayn ohjelmaosoite');
    return parseViaplay(JSON.parse(await request(link.href)));
  });
  return {
    items: unique([first, ...pages].flatMap(p => p.items)),
    coverageThrough: [date, ...links.map(l => l.date)].sort().at(-1), url: VIAPLAY_URL,
  };
}

export function viaplayPageData(html) {
  const $ = load(html);
  return JSON.parse($('#__NEXT_DATA__').text()).props.pageProps.storeState.page.page.raw;
}
