import { request, mapLimit, unique } from '../http.mjs';
import { addDays } from '../time.mjs';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
export function parseEspn(raw, league) {
  if (!Array.isArray(raw.events) || !raw.leagues?.length) throw new Error(`${league}: aikataulun rakenne muuttui`);
  return raw.events.map(event => {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find(c => c.homeAway === 'home')?.team;
    const away = competition?.competitors?.find(c => c.homeAway === 'away')?.team;
    if (!event.id || !home?.abbreviation || !away?.abbreviation || !Number.isFinite(Date.parse(event.date))) throw new Error(`${league}: ottelutiedot puuttuvat`);
    const state = competition.status?.type ?? event.status?.type;
    return { league, id: String(event.id), startTimeUTC: new Date(event.date).toISOString(),
      home: { name: home.displayName, abbrev: home.abbreviation }, away: { name: away.displayName, abbrev: away.abbreviation },
      gameState: state?.completed ? 'FINAL' : state?.state === 'in' ? 'LIVE' : 'FUT',
      scheduleState: /postpon|cancel|tbd|delay|suspend/i.test(state?.name ?? '') || competition.timeValid === false ? 'TBD' : 'OK',
      url: event.links?.find(link => link.href?.startsWith('https://www.espn.com/'))?.href ?? `https://www.espn.com/${league}/`,
    };
  });
}
export async function fetchEspn({ date, days }, league) {
  const sport = league === 'nba' ? 'basketball/nba' : 'football/nfl';
  // Individual dates work for both NBA and NFL, including preseason and playoffs.
  const dates = Array.from({ length: days + 1 }, (_, i) => addDays(date, i));
  const pages = await mapLimit(dates, 3, async d => parseEspn(JSON.parse(await request(`${ESPN}/${sport}/scoreboard?dates=${d.replaceAll('-', '')}&limit=100`)), league));
  return { items: unique(pages.flat(), g => g.id), url: `https://www.espn.com/${league}/schedule` };
}
export function parseMlb(raw) {
  if (!Array.isArray(raw.dates) || !Number.isInteger(raw.totalGames)) throw new Error('MLB:n aikataulun rakenne muuttui');
  return raw.dates.flatMap(day => day.games ?? []).map(game => {
    const home = game.teams?.home?.team, away = game.teams?.away?.team;
    if (!game.gamePk || !home?.abbreviation || !away?.abbreviation || !Number.isFinite(Date.parse(game.gameDate))) throw new Error('MLB:n ottelutiedot puuttuvat');
    return { league: 'mlb', id: String(game.gamePk), startTimeUTC: game.gameDate,
      home: { name: home.name, abbrev: home.abbreviation }, away: { name: away.name, abbrev: away.abbreviation },
      gameState: game.status.abstractGameState === 'Final' ? 'FINAL' : game.status.abstractGameState === 'Live' ? 'LIVE' : 'FUT',
      scheduleState: game.status.startTimeTBD || /postpon|cancel|suspend|delay/i.test(game.status.detailedState ?? '') ? 'TBD' : 'OK',
      doubleHeader: game.doubleHeader !== 'N', gameNumber: game.gameNumber,
      url: `https://www.mlb.com/gameday/${game.gamePk}`,
    };
  });
}
export async function fetchMlb({ date, days }) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${addDays(date, -1)}&endDate=${addDays(date, days)}&hydrate=team`;
  return { items: parseMlb(JSON.parse(await request(url))), url: 'https://www.mlb.com/schedule' };
}

// These subscriptions cover games in Finland; individual Finnish TV broadcasts
// still require an actual programme-guide match. No US TV channel is inferred.
export function addLeaguePasses(games) {
  return games.map(game => {
    const channel = game.league === 'nba' ? 'nba_pass' : game.league === 'nfl' ? 'nfl_pass' : null;
    if (!channel || game.scheduleState !== 'OK') return game;
    const url = channel === 'nba_pass' ? 'https://www.nba.com/watch/league-pass-stream' : 'https://www.dazn.com/nfl-game-pass';
    return { ...game, broadcasts: [...game.broadcasts, { channel, league: game.league, live: true, url, availability: 'finland-subscription' }] };
  });
}
