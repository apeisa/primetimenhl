import { CHANNELS } from './match.mjs';
import { dateLabel, timestampLabel, addDays, localParts } from './time.mjs';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol) ? escapeHtml(value) : '#'; } catch { return '#'; } };

function gameRow(game) {
  const broadcasts = [...game.broadcasts].sort((a, b) => Number(CHANNELS[b.channel].free) - Number(CHANNELS[a.channel].free));
  const badges = broadcasts.map(b => `<span class="channel ${CHANNELS[b.channel].free ? 'channel-free' : 'channel-paid'}">${escapeHtml(CHANNELS[b.channel].name)}</span>`).join('');
  const scheduled = game.scheduleState !== 'OK';
  return `<li class="game" data-game data-start="${escapeHtml(game.startTimeUTC)}" data-free="${game.free}" data-primetime="${game.primetime}" data-channels="${broadcasts.map(b => b.channel).join(',')}" ${game.free && game.primetime ? '' : 'hidden'}>
    <div class="game-time"><time datetime="${escapeHtml(game.startTimeUTC)}" title="${timestampLabel(game.startTimeUTC)} Suomen aikaa">${escapeHtml(game.time)}</time></div>
    <div class="matchup"><div class="teams"><a href="${safeUrl(game.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(game.away.name)}<span class="versus">–</span>${escapeHtml(game.home.name)}</a></div><div class="game-meta">${scheduled ? '<span class="pending">Ajankohta vahvistamatta</span>' : game.broadcasts.length ? `${game.free ? 'Ilmaiskanavalla' : 'Maksullinen lähetys'}${broadcasts.some(b => b.manual) ? ' · käsin vahvistettu' : ''}` : '<span class="pending">Suomen lähetystieto ei vielä vahvistettu</span>'}</div></div>
    <div class="channels">${badges || '<span class="unknown">Odottaa ohjelmatietoja</span>'}</div>
  </li>`;
}

export function render({ games, generatedAt, days, assetVersion = '' }) {
  const assetQuery = assetVersion ? `?v=${escapeHtml(assetVersion)}` : '';
  const now = new Date(generatedAt);
  const groups = new Map();
  for (const game of games) {
    if (!groups.has(game.viewingDate)) groups.set(game.viewingDate, []);
    groups.get(game.viewingDate).push(game);
  }
  const shown = games.filter(g => g.free && g.primetime);
  const sections = [...groups].map(([date, items]) => `<section class="day" data-day ${items.some(g => g.free && g.primetime) ? '' : 'hidden'}>
    <div class="day-heading"><h2>${escapeHtml(dateLabel(date))}</h2><span class="day-count">${items.filter(g => g.free && g.primetime).length} ottelua</span></div>
    <ul class="games">${items.map(gameRow).join('')}</ul>
  </section>`).join('');
  const firstDate = [localParts(now).date, ...games.map(game => game.viewingDate)].sort()[0];
  const lastDate = addDays(localParts(now).date, days - 1);
  return `<!doctype html>
<html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>Tulevat NHL-pelit</title><meta name="description" content="Tulevat NHL-ottelut Suomen aikaan. Löydä primetime-pelit ja ilmaiset lähetykset MTV Subilta, Star Channelilta ja Viaplay TV:stä."><meta name="theme-color" content="#f7f7f0"><link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/icon-192.png"><script src="./theme.js${assetQuery}"></script><link rel="stylesheet" href="./styles.css${assetQuery}"><script src="./filters.js${assetQuery}" type="module"></script></head>
<body><div class="theme-picker" role="group" aria-label="Teema"><button type="button" data-theme-choice="system" aria-label="Järjestelmäteema" title="Järjestelmäteema" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg></button><button type="button" data-theme-choice="light" aria-label="Vaalea teema" title="Vaalea teema" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button><button type="button" data-theme-choice="dark" aria-label="Tumma teema" title="Tumma teema" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 13.3A9 9 0 0 1 10.7 3.2a9 9 0 1 0 10.1 10.1Z"/></svg></button></div><a class="skip-link" href="#ottelut">Siirry otteluihin</a><div class="shell">
<main>
<header class="page-header"><h1 id="title">Tulevat NHL-pelit</h1><p class="date-range">${dateLabel(firstDate).split(' ').slice(1).join(' ')} – ${dateLabel(lastDate).split(' ').slice(1).join(' ')}</p></header>
<section class="schedule" id="ottelut" aria-label="Ottelulista">
<form class="filters" aria-label="Suodata otteluita"><label class="toggle"><input id="primetime" name="primetime" type="checkbox" checked><span class="switch" aria-hidden="true"></span><span>Primetime <small>Viimeistään klo 24.00</small></span></label><label class="toggle"><input id="free-only" name="free" type="checkbox" checked><span class="switch" aria-hidden="true"></span><span>Vain ilmaiskanavat <small>Sub · Star · Viaplay TV</small></span></label></form>
<p class="total-count" id="result-count" role="status" aria-live="polite">${shown.length} ottelua</p>
<div class="empty-state" id="empty-state" ${shown.length ? 'hidden' : ''}><h3>Ei otteluita näillä suodattimilla</h3><p>Kokeile näyttää myös maksulliset lähetykset tai yöpelit. Kaikkien kanavien ohjelmatietoja ei vielä julkaista koko jaksolle.</p><button type="button" id="show-all">Näytä kaikki tulevat ottelut</button></div>
<div id="game-list">${sections}</div>
<noscript><p class="notice">Näytetään primetime-pelit ilmaiskanavilta. Suodattimien muuttaminen vaatii JavaScriptin.</p></noscript>
</section>
</main><footer><p>Ottelun alkamisaika tulee NHL:ltä. Kanavan studio tai lähetys voi alkaa jo aiemmin. Ilmaiskanava tarkoittaa maksutonta TV-lähetystä; saman kanavan verkkokatselu voi vaatia tilauksen.</p><p>Päivitetty <time id="updated" datetime="${escapeHtml(generatedAt)}">${timestampLabel(generatedAt)}</time></p></footer></div></body></html>`;
}
