import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinViewingWindow } from '../public/time-window.js';
import { upcomingGames } from '../src/match.mjs';
import { render } from '../src/render.mjs';
import { load } from 'cheerio';

test('every start stays visible until three hours have elapsed, regardless of time of day', () => {
  for (const start of ['2026-11-06T12:00:00+02:00', '2026-11-06T21:00:00+02:00',
    '2026-11-06T22:00:00+02:00', '2026-11-06T23:00:00+02:00',
    '2026-11-07T00:00:00+02:00', '2026-11-07T00:01:00+02:00', '2026-11-07T03:30:00+02:00']) {
    const instant = Date.parse(start);
    for (const elapsed of [-1, 0, 60 * 60_000, 3 * 60 * 60_000 - 1]) {
      assert.equal(isWithinViewingWindow(start, instant + elapsed), true, `${start}: ${elapsed}`);
    }
    assert.equal(isWithinViewingWindow(start, instant + 3 * 60 * 60_000), false);
    assert.equal(isWithinViewingWindow(start, instant + 24 * 60 * 60_000), false);
  }
  assert.equal(isWithinViewingWindow('invalid', Date.now()), false);
});

test('three hours means elapsed time on both daylight-saving change nights', () => {
  const autumn = '2026-10-25T02:30:00+03:00';
  assert.equal(isWithinViewingWindow(autumn, '2026-10-25T04:29:59.999+02:00'), true);
  assert.equal(isWithinViewingWindow(autumn, '2026-10-25T04:30:00+02:00'), false);
  const spring = '2026-03-29T02:30:00+02:00';
  assert.equal(isWithinViewingWindow(spring, '2026-03-29T06:29:59.999+03:00'), true);
  assert.equal(isWithinViewingWindow(spring, '2026-03-29T06:30:00+03:00'), false);
});

test('build retains all leagues and final states within three hours, keeping the previous date', () => {
  const startTimeUTC = '2026-11-06T21:30:00Z'; // 23:30 Helsinki, remains until 02:30.
  const game = { startTimeUTC, scheduleState: 'OK', away: { name: 'Away' }, home: { name: 'Home' },
    broadcasts: [{ channel: 'sub' }], url: 'https://www.nhl.com/' };
  const input = ['nhl', 'nba', 'nfl', 'mlb'].flatMap(league => ['FUT', 'LIVE', 'FINAL', 'OFF'].map((gameState, id) => ({ ...game, league, gameState, id })));
  const now = new Date('2026-11-07T00:29:59.999Z');
  const games = upcomingGames(input, { now, days: 14 });
  assert.equal(games.length, input.length);
  assert.ok(games.every(g => g.viewingDate === '2026-11-06'));
  const $ = load(render({ games, generatedAt: now.toISOString(), days: 14 }));
  assert.equal($('[data-game]:not([hidden])').length, 4); // default NHL selection
  assert.match($('.date-range').text(), /^6\. marraskuuta/);
  assert.equal(upcomingGames(input, { now: new Date('2026-11-07T00:30:00Z'), days: 14 }).length, 0);
});
