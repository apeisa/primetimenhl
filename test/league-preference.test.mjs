import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const code = (await readFile(new URL('../public/filters.js', import.meta.url), 'utf8')).replace(/^import .*\n/, '');
function open(store, url = 'https://example.org/primetimenhl/', blocked = false) {
  const clicks = {}, pressed = {}, elements = {};
  const buttons = ['nhl', 'nba', 'nfl', 'mlb', 'all'].map(league => ({ dataset: { leagueChoice: league },
    addEventListener: (_, callback) => { clicks[league] = callback; }, setAttribute: (_, value) => { pressed[league] = value; } }));
  for (const selector of ['#primetime', '#free-only', '.filters', '#show-all', '#title', '#result-count', '#empty-state']) {
    elements[selector] = { checked: true, addEventListener() {} };
  }
  const location = new URL(url);
  let replacedUrl;
  vm.runInNewContext(code, {
    document: { querySelector: selector => elements[selector], querySelectorAll: selector => selector === '[data-league-choice]' ? buttons : [] },
    URL, URLSearchParams, location, Date, navigator: {}, setInterval() {}, isWithinViewingWindow: () => true,
    history: { replaceState: (_, __, value) => { replacedUrl = value.href; } },
    localStorage: { getItem: key => { if (blocked) throw Error('blocked'); return store.get(key); },
      setItem: (key, value) => { if (blocked) throw Error('blocked'); store.set(key, value); } }
  });
  return { clicks, pressed, elements, url: () => replacedUrl };
}

test('league choice survives a new browser or PWA launch, including switching back to NHL', () => {
  const store = new Map();
  let page = open(store); assert.equal(page.pressed.nhl, 'true');
  page.clicks.nfl(); assert.equal(store.get('primetime-league'), 'nfl');
  page = open(store); assert.equal(page.pressed.nfl, 'true'); assert.equal(page.elements['#title'].textContent, 'Tulevat NFL-pelit');
  page.clicks.nhl(); assert.equal(page.url(), 'https://example.org/primetimenhl/');
  assert.equal(open(store).pressed.nhl, 'true');
  page.clicks.all(); assert.equal(open(store).pressed.all, 'true');
});

test('explicit shared link wins over saved preference; invalid values do not change it', () => {
  const store = new Map([['primetime-league', 'nfl']]);
  assert.equal(open(store, 'https://example.org/primetimenhl/?league=nba').pressed.nba, 'true');
  assert.equal(store.get('primetime-league'), 'nba');
  assert.equal(open(store, 'https://example.org/primetimenhl/?league=constructor').pressed.nba, 'true');
  store.set('primetime-league', 'toString'); assert.equal(open(store).pressed.nhl, 'true');
});

test('blocked storage still allows league selection and URL sharing', () => {
  const page = open(new Map(), 'https://example.org/primetimenhl/', true);
  page.clicks.mlb(); assert.equal(page.pressed.mlb, 'true');
  assert.equal(page.url(), 'https://example.org/primetimenhl/?league=mlb');
});
