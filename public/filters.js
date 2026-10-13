import { isWithinViewingWindow } from './time-window.js';
const primetime = document.querySelector('#primetime');
const freeOnly = document.querySelector('#free-only');
const leagueButtons = [...document.querySelectorAll('[data-league-choice]')];
const leagues = { nhl: 'NHL', nba: 'NBA', nfl: 'NFL', mlb: 'MLB' };
let league = 'nhl';
const games = [...document.querySelectorAll('[data-game]')];
const days = [...document.querySelectorAll('[data-day]')];
const params = new URLSearchParams(location.search);
if (params.get('league') === 'all' || Object.hasOwn(leagues, params.get('league'))) league = params.get('league');
if (params.has('primetime')) primetime.checked = params.get('primetime') !== '0';
if (params.has('free')) freeOnly.checked = params.get('free') !== '0';

function update(saveUrl = false) {
  const now = Date.now();
  let count = 0;
  for (const game of games) {
    game.hidden = !isWithinViewingWindow(game.dataset.start, now)
      || (league !== 'all' && game.dataset.league !== league)
      || (primetime.checked && game.dataset.primetime !== 'true')
      || (freeOnly.checked && game.dataset.free !== 'true');
    if (!game.hidden) count++;
  }
  for (const day of days) {
    const visible = [...day.querySelectorAll('[data-game]')].filter(game => !game.hidden).length;
    day.hidden = !visible;
    day.querySelector('.day-count').textContent = `${visible} ${visible === 1 ? 'ottelu' : 'ottelua'}`;
  }
  for (const button of leagueButtons) button.setAttribute('aria-pressed', String(button.dataset.leagueChoice === league));
  for (const notice of document.querySelectorAll('[data-source-league]')) notice.hidden = league !== 'all' && notice.dataset.sourceLeague !== league;
  document.querySelector('#title').textContent = league === 'all' ? 'Tulevat jenkkipelit' : `Tulevat ${leagues[league]}-pelit`;
  document.title = document.querySelector('#title').textContent;
  document.querySelector('#result-count').textContent = `${count} ${count === 1 ? 'ottelu' : 'ottelua'}`;
  document.querySelector('#empty-state').hidden = count > 0;
  if (saveUrl) {
    const url = new URL(location.href);
    for (const [key, value, defaultValue] of [['league', league, 'nhl'], ['primetime', primetime.checked ? '1' : '0', '1'], ['free', freeOnly.checked ? '1' : '0', '1']]) {
      if (value === defaultValue) url.searchParams.delete(key); else url.searchParams.set(key, value);
    }
    url.searchParams.delete('channel');
    history.replaceState(null, '', url);
  }
}

document.querySelector('.filters').addEventListener('submit', event => event.preventDefault());
for (const input of [primetime, freeOnly]) input.addEventListener('change', () => update(true));
for (const button of leagueButtons) button.addEventListener('click', () => { league = button.dataset.leagueChoice; update(true); });
document.querySelector('#show-all').addEventListener('click', () => {
  primetime.checked = false; freeOnly.checked = false; update(true);
});
update();
setInterval(update, 60_000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline-tila ei ole käytettävissä:', error));
}
