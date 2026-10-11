import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinViewingWindow } from '../public/time-window.js';
import { upcomingGames } from '../src/match.mjs';
import { render } from '../src/render.mjs';
import { load } from 'cheerio';

// All boundaries are given in Helsinki's local time, with its actual UTC offset.
test('late starts survive midnight until exactly 02:00; earlier and older starts do not', () => {
  const start = '2026-10-11T22:00:00+03:00';
  assert.equal(isWithinViewingWindow(start, '2026-10-11T22:30:00+03:00'), true);
  assert.equal(isWithinViewingWindow(start, '2026-10-12T00:00:00+03:00'), true);
  assert.equal(isWithinViewingWindow(start, '2026-10-12T01:59:59+03:00'), true);
  assert.equal(isWithinViewingWindow(start, '2026-10-12T02:00:00+03:00'), false);
  assert.equal(isWithinViewingWindow('2026-10-11T21:59:00+03:00', '2026-10-12T01:00:00+03:00'), false);
  assert.equal(isWithinViewingWindow('2026-10-10T23:00:00+03:00', '2026-10-12T01:00:00+03:00'), false);
  assert.equal(isWithinViewingWindow('2026-10-12T00:00:00+03:00', '2026-10-12T01:00:00+03:00'), true);
  assert.equal(isWithinViewingWindow('2026-10-12T00:01:00+03:00', '2026-10-12T01:00:00+03:00'), false);
  assert.equal(isWithinViewingWindow('2026-10-12T20:00:00+03:00', '2026-10-12T01:00:00+03:00'), true);
});

test('02:00 cutoff follows Helsinki time in winter and on the DST change night', () => {
  assert.equal(isWithinViewingWindow('2026-12-11T22:00:00+02:00', '2026-12-12T01:59:59+02:00'), true);
  assert.equal(isWithinViewingWindow('2026-12-11T22:00:00+02:00', '2026-12-12T02:00:00+02:00'), false);
  assert.equal(isWithinViewingWindow('2026-10-24T23:00:00+03:00', '2026-10-25T01:59:59+03:00'), true);
  assert.equal(isWithinViewingWindow('2026-10-24T23:00:00+03:00', '2026-10-25T02:00:00+03:00'), false);
});

test('post-midnight build retains live late games and previous date; finished games stay excluded', () => {
  const game = { id: 1, startTimeUTC: '2026-10-11T20:00:00Z', gameState: 'LIVE', scheduleState: 'OK',
    away: { name: 'Seattle Kraken' }, home: { name: 'Washington Capitals' },
    broadcasts: [{ channel: 'sub' }], url: 'https://www.nhl.com/' };
  const now = new Date('2026-10-11T22:30:00Z');
  const games = upcomingGames([game, { ...game, id: 2, gameState: 'FINAL' }], { now, days: 14 });
  assert.equal(games.length, 1); assert.equal(games[0].viewingDate, '2026-10-11');
  const $ = load(render({ games, generatedAt: now.toISOString(), days: 14 }));
  assert.equal($('[data-game]:not([hidden])').length, 1);
  assert.match($('.date-range').text(), /^11\. lokakuuta/);
  assert.equal(upcomingGames([game], { now: new Date('2026-10-11T23:00:00Z'), days: 14 }).length, 0);
});
