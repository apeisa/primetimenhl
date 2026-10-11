import { load } from 'cheerio';
import { request, mapLimit, unique } from '../http.mjs';
import { addDays } from '../time.mjs';
import { isGameTitle } from '../teams.mjs';

const API_URL = 'https://nordic-gateway.mtv.a2d.tv/graphql';
export const MTV_URL = 'https://www.mtv.fi/kanavat/aikataulu';
const EPG_QUERY = `query Epg($id: ID!, $date: Date) {
  media(id: $id) { ... on Channel {
    id epg(fullBroadcastDay: true, date: $date) {
      broadcastId title start end type
      media { __typename ... on EpgItemSportEventReference { content { id playableFrom { isoString } } } }
    }
  } }
}`;

export function parseMtv(raw, date) {
  if (raw.errors?.length || !Array.isArray(raw.data?.media?.epg)) {
    throw new Error(raw.errors?.[0]?.message ?? 'MTV:n ohjelmaoppaan rakenne muuttui');
  }
  const items = raw.data.media.epg.filter(event =>
    /NHL/i.test(event.title) && isGameTitle(event.title)
    && event.type === 'LIVE'
  ).map(event => {
    if (!Number.isFinite(Date.parse(event.start))) throw new Error('MTV:n lähetysaika puuttuu');
    // The provider's LIVE flag and proximity to the NHL start identify live games.
    return { title: event.title, startTimeUTC: new Date(event.start).toISOString(), channel: 'sub', live: true, url: `${MTV_URL}?d=${date}` };
  });
  return items;
}

async function discoverVersion() {
  const $ = load(await request('https://www.mtv.fi/kanavat'));
  const urls = $('script[src]').toArray().map(e => $(e).attr('src')).filter(s => s.startsWith('/_next/static/chunks/'));
  const chunks = await mapLimit(urls, 4, url => request(new URL(url, 'https://www.mtv.fi').href));
  for (const chunk of chunks) {
    const version = chunk.match(/exports=\{name:"web",version:"([\d.]+)"/)?.[1];
    if (version) return version;
  }
  throw new Error('MTV:n julkisen sivun asiakasversiota ei löytynyt');
}

export async function fetchMtv({ date, days }) {
  let version = process.env.MTV_CLIENT_VERSION ?? '5.5.0';
  async function query(query, variables = {}) {
    const result = JSON.parse(await request(API_URL, {
      method: 'POST', headers: { 'content-type': 'application/json', 'client-name': 'mtv-web', 'client-version': version },
      body: JSON.stringify({ query, variables }),
    }));
    if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
    return result;
  }
  let channels;
  try { channels = await query('query Channels { channels { id title } }'); }
  catch (error) {
    if (!/version|deprecated/i.test(error.message)) throw error;
    version = await discoverVersion();
    channels = await query('query Channels { channels { id title } }');
  }
  const sub = channels.data?.channels?.find(c => /^(MTV )?SUB$/i.test(c.title));
  if (!sub) throw new Error('Sub puuttuu MTV:n kanavalistasta');
  const dates = Array.from({ length: days }, (_, i) => addDays(date, i));
  const results = await mapLimit(dates, 3, async d => {
    // EPG uses numeric epoch milliseconds and a broadcasting day starting at 06:00.
    // Noon UTC selects the intended Finnish broadcasting day, even across DST.
    const raw = await query(EPG_QUERY, { id: sub.id, date: Date.parse(`${d}T12:00:00Z`) });
    return { items: parseMtv(raw, d), date: d, count: raw.data.media.epg.length };
  });
  if (!results.some(r => r.count)) throw new Error('MTV:n ohjelmaopas on tyhjä');
  return {
    items: unique(results.flatMap(r => r.items)),
    coverageThrough: results.filter(r => r.count).map(r => r.date).at(-1), url: MTV_URL,
  };
}
