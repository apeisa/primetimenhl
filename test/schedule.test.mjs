import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { viewingTime, localParts } from '../src/time.mjs';
import { teamsInTitle, isGameTitle } from '../src/teams.mjs';
import { matchBroadcasts, upcomingGames, applyOverrides } from '../src/match.mjs';
import { parseStar } from '../src/sources/star.mjs';
import { parseMtv } from '../src/sources/mtv.mjs';
import { parseViaplayTv, helsinkiInstant } from '../src/sources/viaplaytv.mjs';
import { parseViaplay } from '../src/sources/viaplay.mjs';
import { cachedSource, verifiedCertificateChain } from '../src/http.mjs';
import { render } from '../src/render.mjs';
import { load } from 'cheerio';

const game = { id: 123, startTimeUTC: '2026-10-11T21:00:00Z', scheduleState: 'OK', gameState: 'FUT',
  away: { name: 'Seattle Kraken', abbrev: 'SEA' }, home: { name: 'Washington Capitals', abbrev: 'WSH' }, url: 'https://www.nhl.com/gamecenter/test' };
const broadcast = { title: 'NHL: Washington - Seattle', startTimeUTC: '2026-10-11T20:45:00Z', channel: 'sub', live: true, url: 'https://www.mtv.fi/' };

test('midnight is primetime and belongs to the preceding evening; 00.01 does not', () => {
  assert.deepEqual(viewingTime(game.startTimeUTC), { date: '2026-10-12', viewingDate: '2026-10-11', time: '24.00', primetime: true });
  assert.equal(viewingTime('2026-10-11T21:01:00Z').primetime, false);
  assert.equal(viewingTime('2026-10-11T09:00:00Z').primetime, true);
  assert.equal(viewingTime('2026-10-11T08:59:00Z').primetime, false);
});

test('Helsinki winter/summer time and DST changes do not use a fixed UTC offset', () => {
  assert.equal(localParts('2026-10-24T21:00:00Z').hour, 0);
  assert.equal(localParts('2026-10-25T22:00:00Z').hour, 0);
  assert.equal(helsinkiInstant('2026-10-24', 23, 0), '2026-10-24T20:00:00.000Z');
  assert.equal(helsinkiInstant('2026-10-25', 23, 0), '2026-10-25T21:00:00.000Z');
  assert.equal(localParts('2026-03-29T01:00:00Z').hour, 4);
});

test('team aliases recognize cities/nicknames without confusing the New York teams', () => {
  assert.deepEqual(teamsInTitle('NHL: Sabres vs Panthers'), ['BUF', 'FLA']);
  assert.deepEqual(teamsInTitle('NY Rangers - New York Islanders'), ['NYI', 'NYR']);
  assert.equal(isGameTitle('NHL On The Fly'), false);
  assert.equal(isGameTitle('Uusinta: Washington - Seattle'), false);
});

test('studio start matches; replays, wrong teams and ambiguous games never become free broadcasts', () => {
  const { games, unmatched } = matchBroadcasts([game], [broadcast, { ...broadcast, channel: 'star' }, { ...broadcast, startTimeUTC: '2026-10-12T14:00:00Z' }, { ...broadcast, live: false }, { ...broadcast, title: 'Buffalo - Florida' }]);
  assert.equal(games[0].broadcasts.length, 2);
  assert.equal(unmatched.length, 2);
  assert.equal(matchBroadcasts([game, { ...game, id: 124 }], [broadcast]).games[0].broadcasts.length, 0);
  assert.equal(matchBroadcasts([{ ...game, scheduleState: 'TBD' }], [broadcast]).games[0].broadcasts.length, 0);
});

test('split TV segments are deduplicated while multiple channels remain on one game', () => {
  const result = matchBroadcasts([game], [broadcast, { ...broadcast, startTimeUTC: '2026-10-11T21:10:00Z' }, { ...broadcast, channel: 'viaplay' }]);
  assert.equal(result.games[0].broadcasts.length, 2);
  assert.equal(result.games[0].broadcasts[0].startTimeUTC, broadcast.startTimeUTC);
});

test('MTV uses its LIVE flag even when a sport media reference is null', () => {
  const event = { title: broadcast.title, start: broadcast.startTimeUTC, type: 'LIVE', media: null };
  const result = parseMtv({ data: { media: { epg: [event, { ...event, type: 'RERUN' }, { ...event, title: 'NHL-sirkus' }] } } }, '2026-10-11');
  assert.equal(result.length, 1);
  assert.throws(() => parseMtv({ errors: [{ message: 'broken' }] }));
});

test('Star reads timestamps and rejects explicitly marked replays', () => {
  const row = desc => `<li class="acilia-schedule-event" data-datetime-timestamp="1791834300" data-datetime-date="2026-10-12"><h3>NHL 26-27</h3><div class="description"><h4>NHL: Sabres vs Panthers, Kausi 2627</h4><p>${desc}</p></div></li>`;
  assert.equal(parseStar(row('Koe NHL suorana.')).items.length, 1);
  assert.equal(parseStar(row('Uusinta')).items.length, 0);
  assert.throws(() => parseStar('<html>huoltokatko</html>'));
});

test('Viaplay TV requires LIVE and handles a broadcasting day crossing midnight', () => {
  const row = (time, live) => `<div class="programslide"><h5>NHL – Washington - Seattle</h5><p class="time">${time} – 03:00</p>${live ? '<span class="live-tag">LIVE</span>' : ''}</div>`;
  const result = parseViaplayTv(row('23:00', false) + row('00:00', true), '2026-10-11');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].startTimeUTC, '2026-10-11T21:00:00.000Z');
});

test('Viaplay ignores highlights, magazines and non-live recordings', () => {
  const event = { type: 'sport', content: { format: { title: 'NHL' }, title: 'Washington - Seattle' }, system: { flags: ['liveStream'] }, recording: { airingType: 'live' }, epg: { start: game.startTimeUTC }, publicPath: 'jaakiekko/nhl/test' };
  const result = parseViaplay({ responseCode: { httpStatus: 200 }, _embedded: { products: [event, event, { ...event, recording: { airingType: 'replay' } }, { ...event, content: { ...event.content, title: 'NHL On The Fly' } }] } });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].channel, 'viaplay');
});

test('failed source parsing preserves the last valid data and its original timestamp', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nhl-cache-test-'));
  try {
    const saved = await cachedSource('test', dir, async () => ({ items: [broadcast] }), { now: new Date('2026-10-11T12:00:00Z') });
    const fallback = await cachedSource('test', dir, async () => { throw new Error('schema changed'); }, { now: new Date('2026-10-11T18:00:00Z') });
    assert.equal(saved.status, 'ok'); assert.equal(fallback.status, 'cached');
    assert.equal(fallback.fetchedAt, saved.fetchedAt); assert.equal(fallback.items.length, 1);
    assert.equal((await cachedSource('missing', dir, async () => {}, { offline: true })).status, 'error');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the bundled missing intermediate is signed by a root already trusted by Node', async () => {
  const pem = await readFile(new URL('../src/certificates/sectigo-ov-r36.pem', import.meta.url), 'utf8');
  assert.ok(verifiedCertificateChain([pem]).includes(pem));
  assert.throws(() => verifiedCertificateChain(['not a certificate']));
});

test('render includes real rows, escapes source text, defaults to free primetime and uses relative assets', () => {
  const matched = matchBroadcasts([game, { ...game, id: 124, startTimeUTC: '2026-10-12T00:00:00Z' }], [broadcast]).games;
  const games = upcomingGames(matched, { now: new Date('2026-10-11T20:00:00Z'), days: 14 });
  games[0].away.name = '<script>alert(1)</script>';
  const html = render({ games, sources: [], generatedAt: '2026-10-11T20:00:00Z', days: 14 });
  const $ = load(html);
  assert.equal($('[data-game]').length, 2); assert.equal($('[data-game]:not([hidden])').length, 1);
  assert.equal($('#primetime').is('[checked]'), true); assert.equal($('#free-only').is('[checked]'), true);
  assert.equal($('script:not([src])').length, 0); assert.equal($('link[rel="stylesheet"]').attr('href'), './styles.css');
  assert.ok(html.includes('&lt;script&gt;'));
});

test('manual corrections merge into a game and started games disappear', () => {
  const games = applyOverrides([{ ...game, broadcasts: [broadcast] }], [{ gameId: game.id, removeChannels: ['sub'], broadcasts: [{ channel: 'disney', url: 'https://www.disneyplus.com/' }] }]);
  assert.equal(games[0].broadcasts[0].channel, 'disney');
  assert.equal(upcomingGames(games, { now: new Date('2026-10-11T22:00:00Z'), days: 14 }).length, 0);
});
