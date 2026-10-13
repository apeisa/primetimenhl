import { request, mapLimit, unique } from '../http.mjs';
import { localParts, addDays } from '../time.mjs';
import { isGameTitle } from '../teams.mjs';

const API = 'https://viihde-epg-api-prod.csf.elisa.fi/epg';
export const EPG_URL = 'https://elisaviihde.fi/ohjelmaopas';
const CHANNELS = { TV5: 'tv5', Kutonen: 'kutonen', Nelonen: 'nelonen', Jim: 'jim', Hero: 'hero' };
export function parseEpg(raw) {
  if (raw.timezone !== 'Europe/Helsinki' || !Array.isArray(raw.schedule)) throw new Error('EPG:n rakenne tai aikavyöhyke muuttui');
  const items = [];
  let coverageThrough = null;
  for (const day of raw.schedule) {
    if (!Array.isArray(day.programs)) throw new Error('EPG:n ohjelmalista puuttuu');
    for (const p of day.programs) {
      const channel = CHANNELS[p.channel?.name];
      if (!channel) continue;
      if (!Number.isFinite(p.startTimeUTC)) throw new Error('EPG:n alkamisaika puuttuu');
      const startTimeUTC = new Date(p.startTimeUTC).toISOString();
      const date = localParts(startTimeUTC).date;
      if (!coverageThrough || date > coverageThrough) coverageThrough = date;
      const league = /\bNBA\b/i.test(p.name) ? 'nba' : /\bNFL\b/i.test(p.name) ? 'nfl' : null;
      const description = p.shortDescription ?? '';
      if (!league || /uusinta|replay|kooste|highlights/i.test(`${p.name} ${description}`)
          || !/suora|live/i.test(`${p.name} ${description}`)) continue;
      const title = `${p.name} ${description}`.trim();
      items.push({ league, title, startTimeUTC, channel, live: true,
        unnamed: !isGameTitle(title, league), url: EPG_URL, programId: p.id });
    }
  }
  return { items: unique(items, x => `${x.channel}:${x.programId}`), coverageThrough, url: EPG_URL };
}
export async function fetchFinnishEpg({ date, days }) {
  const rawChannels = JSON.parse(await request(`${API}/channels`));
  if (!Array.isArray(rawChannels.channels)) throw new Error('EPG:n kanavalista puuttuu');
  const channels = Object.keys(CHANNELS).map(name => rawChannels.channels.find(c => c.name === name));
  if (channels.some(c => !c)) throw new Error('EPG:stä puuttuu tuettu kanava');
  // The provider accepts a maximum of seven calendar dates per request.
  const chunks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => ({ from: addDays(date, i * 7), to: addDays(date, Math.min(days - 1, i * 7 + 6)) }));
  const tasks = channels.flatMap(channel => chunks.map(range => ({ channel, range })));
  const results = await mapLimit(tasks, 3, async ({ channel, range }) => {
    const params = new URLSearchParams({ channelId: String(channel.id), timeRange: `${range.from}T00:00:01,${range.to}T23:59:59`, showHiddenChannels: 'true' });
    return parseEpg(JSON.parse(await request(`${API}/schedule?${params}`)));
  });
  return { items: unique(results.flatMap(r => r.items), x => `${x.channel}:${x.programId}`),
    coverageThrough: results.map(r => r.coverageThrough).filter(Boolean).sort().at(-1), url: EPG_URL };
}

export function resolveUnnamedBroadcasts(broadcasts, ruutu) {
  return broadcasts.map(b => {
    if (!b.unnamed || b.league !== 'nfl') return b;
    const matches = ruutu.filter(r => r.league === 'nfl' && r.live && r.language === 'fi'
      && Math.abs(Date.parse(r.startTimeUTC) - Date.parse(b.startTimeUTC)) <= 20 * 60_000);
    if (matches.length !== 1) return b;
    return { ...b, title: matches[0].title, unnamed: false,
      matchedBy: 'unique-finnish-live-slot', evidence: [b.url, matches[0].url] };
  });
}
