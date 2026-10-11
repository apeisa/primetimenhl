import { isWithinViewingWindow } from '../public/time-window.js';
import { teamsInTitle } from './teams.mjs';
import { viewingTime, addDays, localParts } from './time.mjs';

export const CHANNELS = {
  sub: { name: 'MTV Sub', free: true, url: 'https://www.mtv.fi/kanavat/aikataulu' },
  star: { name: 'Star Channel', free: true, url: 'https://www.starchannel.fi/ohjelmaopas/star' },
  viaplaytv: { name: 'Viaplay TV', free: true, url: 'https://viaplaytv.fi/ohjelmatiedot/' },
  viaplay: { name: 'Viaplay', free: false, url: 'https://viaplay.fi/urheilu/jaakiekko/nhl' },
  disney: { name: 'Disney+', free: false, url: 'https://www.disneyplus.com/' },
};

export function matchBroadcasts(games, broadcasts) {
  const matched = new Map(games.map(game => [game.id, []]));
  const unmatched = [];
  for (const broadcast of broadcasts) {
    if (broadcast.live !== true || !CHANNELS[broadcast.channel]) continue;
    const teams = teamsInTitle(broadcast.title);
    const candidates = games.filter(game => {
      if (teams.length !== 2 || !teams.includes(game.home.abbrev) || !teams.includes(game.away.abbrev)) return false;
      const difference = (Date.parse(broadcast.startTimeUTC) - Date.parse(game.startTimeUTC)) / 60_000;
      return difference >= -60 && difference <= 20 && game.scheduleState === 'OK';
    });
    if (candidates.length !== 1) { unmatched.push(broadcast); continue; }
    const list = matched.get(candidates[0].id);
    // A game may be split around the news; retain the first segment per channel.
    const existing = list.find(x => x.channel === broadcast.channel);
    if (!existing) list.push(broadcast);
    else if (broadcast.startTimeUTC < existing.startTimeUTC) Object.assign(existing, broadcast);
  }
  return { games: games.map(game => ({ ...game, broadcasts: matched.get(game.id) })), unmatched };
}

export function applyOverrides(games, overrides) {
  if (!Array.isArray(overrides)) throw new Error('overrides.json pitää olla lista');
  const byId = new Map(games.map(game => [game.id, game]));
  for (const override of overrides) {
    const game = byId.get(override.gameId);
    if (!game) continue;
    if (override.startTimeUTC) {
      if (!Number.isFinite(Date.parse(override.startTimeUTC))) throw new Error('Virheellinen korjattu alkamisaika');
      game.startTimeUTC = new Date(override.startTimeUTC).toISOString();
    }
    if (override.removeChannels) game.broadcasts = game.broadcasts.filter(b => !override.removeChannels.includes(b.channel));
    for (const b of override.broadcasts ?? []) {
      if (!CHANNELS[b.channel] || !b.url || !['https:', 'http:'].includes(new URL(b.url).protocol)) throw new Error('Virheellinen kanavakorjaus');
      game.broadcasts = game.broadcasts.filter(existing => existing.channel !== b.channel);
      game.broadcasts.push({ ...b, live: true, manual: true, startTimeUTC: b.startTimeUTC ?? game.startTimeUTC });
    }
  }
  return games;
}

export function upcomingGames(games, { now, days }) {
  const endDate = addDays(localParts(now).date, days);
  return games.filter(game => isWithinViewingWindow(game.startTimeUTC, now)
    && localParts(game.startTimeUTC).date < endDate
    && !['FINAL', 'OFF'].includes(game.gameState)
  ).sort((a, b) => Date.parse(a.startTimeUTC) - Date.parse(b.startTimeUTC))
    .map(game => ({ ...game, ...viewingTime(game.startTimeUTC), free: game.broadcasts.some(b => CHANNELS[b.channel].free) }));
}
