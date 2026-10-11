const primetime = document.querySelector('#primetime');
const freeOnly = document.querySelector('#free-only');
const channel = document.querySelector('#channel');
const games = [...document.querySelectorAll('[data-game]')];
const days = [...document.querySelectorAll('[data-day]')];
const params = new URLSearchParams(location.search);
if (params.has('primetime')) primetime.checked = params.get('primetime') !== '0';
if (params.has('free')) freeOnly.checked = params.get('free') !== '0';
if ([...channel.options].some(o => o.value === params.get('channel'))) channel.value = params.get('channel');

function update(saveUrl = false) {
  const now = Date.now();
  let count = 0;
  for (const game of games) {
    game.hidden = Date.parse(game.dataset.start) <= now
      || (primetime.checked && game.dataset.primetime !== 'true')
      || (freeOnly.checked && game.dataset.free !== 'true')
      || (channel.value !== 'all' && !game.dataset.channels.split(',').includes(channel.value));
    if (!game.hidden) count++;
  }
  for (const day of days) {
    const visible = [...day.querySelectorAll('[data-game]')].filter(game => !game.hidden).length;
    day.hidden = !visible;
    day.querySelector('.day-count').textContent = `${visible} ${visible === 1 ? 'ottelu' : 'ottelua'}`;
  }
  document.querySelector('#result-count').textContent = `${count} ${count === 1 ? 'ottelu' : 'ottelua'}`;
  document.querySelector('#empty-state').hidden = count > 0;
  document.querySelector('#stale-notice').hidden = now - Date.parse(document.querySelector('#updated').dateTime) <= 86_400_000;
  if (saveUrl) {
    const url = new URL(location.href);
    for (const [key, value, defaultValue] of [['primetime', primetime.checked ? '1' : '0', '1'], ['free', freeOnly.checked ? '1' : '0', '1'], ['channel', channel.value, 'all']]) {
      if (value === defaultValue) url.searchParams.delete(key); else url.searchParams.set(key, value);
    }
    history.replaceState(null, '', url);
  }
}

document.querySelector('.filters').addEventListener('submit', event => event.preventDefault());
for (const input of [primetime, freeOnly, channel]) input.addEventListener('change', () => update(true));
document.querySelector('#show-all').addEventListener('click', () => {
  primetime.checked = false; freeOnly.checked = false; channel.value = 'all'; update(true);
});
update();
setInterval(update, 60_000);
