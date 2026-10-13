import test from 'node:test';
import assert from 'node:assert/strict';
import { teamsInTitle } from '../src/teams.mjs';
import { matchBroadcasts, applyOverrides } from '../src/match.mjs';
import { parseEspn, parseMlb, addLeaguePasses } from '../src/sources/american-leagues.mjs';
import { parseRuutu } from '../src/sources/ruutu.mjs';
import { parseEpg, resolveUnnamedBroadcasts } from '../src/sources/finnish-epg.mjs';
import { parseViaplay } from '../src/sources/viaplay.mjs';

const start = '2026-10-18T17:00:00.000Z';
const game = { league: 'nfl', id: '123', startTimeUTC: start, scheduleState: 'OK',
  home: { name: 'Baltimore Ravens', abbrev: 'BAL' }, away: { name: 'Cleveland Browns', abbrev: 'CLE' } };
const broadcast = { league: 'nfl', title: 'Cleveland Browns - Baltimore Ravens', startTimeUTC: start, channel: 'ruutu', live: true, language: 'fi', url: 'https://www.ruutu.fi/stream/123' };

test('team names are scoped to the league and ambiguous city-only titles stay ambiguous', () => {
  assert.deepEqual(teamsInTitle('Boston Celtics - Detroit Pistons', 'nba'), ['BOS', 'DET']);
  assert.deepEqual(teamsInTitle('Brewers - Dodgers', 'mlb').sort(), ['LAD', 'MIL']);
  assert.deepEqual(teamsInTitle(broadcast.title, 'nfl'), ['BAL', 'CLE']);
  assert.deepEqual(teamsInTitle(broadcast.title, 'nhl'), []);
  assert.notEqual(teamsInTitle('Los Angeles - Denver', 'nba').length, 2);
});

test('broadcasts and manual corrections cannot cross leagues when IDs or city names collide', () => {
  const nba = { ...game, league: 'nba', home: { abbrev: 'BOS' }, away: { abbrev: 'DET' } };
  const { games } = matchBroadcasts([game, nba], [broadcast]);
  assert.equal(games[0].broadcasts.length, 1); assert.equal(games[1].broadcasts.length, 0);
  const corrected = applyOverrides(games, [{ league: 'nba', gameId: '123', broadcasts: [{ channel: 'hbomax', url: 'https://www.hbomax.com/' }] }]);
  assert.equal(corrected[0].broadcasts[0].channel, 'ruutu'); assert.equal(corrected[1].broadcasts[0].channel, 'hbomax');
});

test('ESPN uses UTC and handles completed games, postponed times and empty off-season days', () => {
  const competitor = (homeAway, name, abbrev) => ({ homeAway, team: { displayName: name, abbreviation: abbrev } });
  const event = { id: '123', date: start, competitions: [{ competitors: [competitor('home', 'Baltimore Ravens', 'BAL'), competitor('away', 'Cleveland Browns', 'CLE')], status: { type: { state: 'pre', name: 'STATUS_SCHEDULED' } } }] };
  const raw = { leagues: [{ id: '28' }], events: [event] };
  assert.equal(parseEspn(raw, 'nfl')[0].startTimeUTC, start);
  event.competitions[0].status.type.completed = true; assert.equal(parseEspn(raw, 'nfl')[0].gameState, 'FINAL');
  event.competitions[0].status.type.name = 'STATUS_POSTPONED'; assert.equal(parseEspn(raw, 'nfl')[0].scheduleState, 'TBD');
  assert.deepEqual(parseEspn({ leagues: [{}], events: [] }, 'nfl'), []);
  assert.throws(() => parseEspn({ events: [] }, 'nfl'));
});

test('MLB doubleheaders keep separate IDs and unfinished/postponed game states', () => {
  const g = { gamePk: 1, gameDate: start, doubleHeader: 'Y', gameNumber: 1, status: { abstractGameState: 'Preview', detailedState: 'Scheduled' }, teams: { home: { team: { name: 'Los Angeles Dodgers', abbreviation: 'LAD' } }, away: { team: { name: 'Milwaukee Brewers', abbreviation: 'MIL' } } } };
  const games = parseMlb({ totalGames: 2, dates: [{ games: [g, { ...g, gamePk: 2, gameNumber: 2, gameDate: '2026-10-18T20:00:00Z' }] }] });
  assert.equal(games.length, 2); assert.notEqual(games[0].id, games[1].id); assert.equal(games[1].gameNumber, 2);
  g.status.detailedState = 'Postponed'; assert.equal(parseMlb({ totalGames: 1, dates: [{ games: [g] }] })[0].scheduleState, 'TBD');
});

test('Ruutu reads only live stream cards, excludes RedZone/replays, and resolves New Year dates', () => {
  const card = (title, day, href = '/stream/123') => `<a href="${href}"><h3><span class="Card__time"><strong>20:00</strong>${day}</span><span class="Card__titleText">${title}</span></h3><img alt="Selostus suomi"></a>`;
  const html = `<h1>NFL</h1>${card(broadcast.title, '1.1.')}${card('NFL RedZone', '1.1.')}${card(broadcast.title, '1.1.', '/video/123')}`;
  const parsed = parseRuutu(html, { date: '2026-12-29', days: 14 }).items;
  assert.equal(parsed.length, 1); assert.equal(parsed[0].startTimeUTC, '2027-01-01T18:00:00.000Z'); assert.equal(parsed[0].language, 'fi');
  assert.throws(() => parseRuutu('<h1>Huoltokatko</h1>', { date: '2026-10-13', days: 14 }));
});

test('free TV is identified from live guide entries; unnamed NFL needs a unique Finnish broadcast', () => {
  const p = { id: 1, name: 'NFL LIVE:', shortDescription: '', startTimeUTC: Date.parse(start), channel: { name: 'Jim' } };
  const parsed = parseEpg({ timezone: 'Europe/Helsinki', schedule: [{ programs: [p, { ...p, id: 2, name: 'NBA: Celtics - Pistons', shortDescription: 'Uusinta' }] }] }).items;
  assert.equal(parsed.length, 1); assert.equal(parsed[0].unnamed, true);
  assert.equal(resolveUnnamedBroadcasts(parsed, [broadcast])[0].title, broadcast.title);
  assert.equal(resolveUnnamedBroadcasts(parsed, [broadcast, { ...broadcast, title: 'Chiefs - Bills' }])[0].unnamed, true);
  assert.equal(resolveUnnamedBroadcasts(parsed, [{ ...broadcast, language: 'en' }])[0].unnamed, true);
  assert.equal(matchBroadcasts([game], resolveUnnamedBroadcasts(parsed, [broadcast])).games[0].broadcasts[0].channel, 'jim');
});

test('Viaplay MLB ignores NHL and replays, and subscriptions do not imply free Finnish TV', () => {
  const event = { type: 'sport', content: { format: { title: 'Major League Baseball' }, title: 'Brewers - Dodgers' }, system: { flags: ['liveStream'] }, recording: { airingType: 'live' }, epg: { start } };
  const items = parseViaplay({ responseCode: 200, _embedded: { products: [event, { ...event, recording: { airingType: 'replay' } }] } }, 'mlb').items;
  assert.equal(items.length, 1); assert.equal(items[0].league, 'mlb');
  const games = addLeaguePasses([{ ...game, broadcasts: [] }, { ...game, league: 'nba', broadcasts: [] }, { ...game, league: 'mlb', broadcasts: [] }]);
  assert.equal(games[0].broadcasts[0].channel, 'nfl_pass'); assert.equal(games[1].broadcasts[0].channel, 'nba_pass'); assert.equal(games[2].broadcasts.length, 0);
});
