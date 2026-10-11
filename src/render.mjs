import { CHANNELS } from './match.mjs';
import { dateLabel, timestampLabel, addDays, localParts } from './time.mjs';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol) ? escapeHtml(value) : '#'; } catch { return '#'; } };

function gameRow(game) {
  const broadcasts = [...game.broadcasts].sort((a, b) => Number(CHANNELS[b.channel].free) - Number(CHANNELS[a.channel].free));
  const badges = broadcasts.map(b => `<a class="channel ${CHANNELS[b.channel].free ? 'channel-free' : 'channel-paid'}" href="${safeUrl(b.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(CHANNELS[b.channel].name)}: avaa ohjelmatiedot">${escapeHtml(CHANNELS[b.channel].name)}</a>`).join('');
  const scheduled = game.scheduleState !== 'OK';
  return `<li class="game" data-game data-start="${escapeHtml(game.startTimeUTC)}" data-free="${game.free}" data-primetime="${game.primetime}" data-channels="${broadcasts.map(b => b.channel).join(',')}" ${game.free && game.primetime ? '' : 'hidden'}>
    <div class="game-time"><time datetime="${escapeHtml(game.startTimeUTC)}" title="${timestampLabel(game.startTimeUTC)} Suomen aikaa">${escapeHtml(game.time)}</time><span>${game.primetime ? 'PRIMETIME' : 'YÖPELI'}</span></div>
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
  const lastDate = addDays(localParts(now).date, days - 1);
  return `<!doctype html>
<html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>Tulevat NHL-pelit Suomessa</title><meta name="description" content="Tulevat NHL-ottelut Suomen aikaan. Löydä primetime-pelit ja ilmaiset lähetykset MTV Subilta, Star Channelilta ja Viaplay TV:stä."><meta name="theme-color" content="#f7f7f0"><link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/icon-192.png"><script src="./theme.js${assetQuery}"></script><link rel="stylesheet" href="./styles.css${assetQuery}"><script src="./filters.js${assetQuery}" defer></script></head>
<body><a class="skip-link" href="#ottelut">Siirry otteluihin</a><div class="shell">
<main>
<header class="page-header"><h1 id="title">Tulevat NHL-pelit Suomessa</h1><p class="date-range">${dateLabel(localParts(now).date).split(' ').slice(1).join(' ')} – ${dateLabel(lastDate).split(' ').slice(1).join(' ')}</p></header>
<section class="schedule" id="ottelut" aria-label="Ottelulista">
<form class="filters" aria-label="Suodata otteluita"><label class="toggle"><input id="primetime" name="primetime" type="checkbox" checked><span class="switch" aria-hidden="true"></span><span>Primetime <small>Viimeistään klo 24.00</small></span></label><label class="toggle"><input id="free-only" name="free" type="checkbox" checked><span class="switch" aria-hidden="true"></span><span>Vain ilmaiskanavat <small>Sub · Star · Viaplay TV</small></span></label><div class="theme-select"><label for="theme">Teema</label><select id="theme" name="theme"><option value="system">Järjestelmä</option><option value="light">Vaalea</option><option value="dark">Tumma</option></select></div></form>
<p class="total-count" id="result-count" role="status" aria-live="polite">${shown.length} ottelua</p>
<div class="empty-state" id="empty-state" ${shown.length ? 'hidden' : ''}><h3>Ei otteluita näillä suodattimilla</h3><p>Kokeile näyttää myös maksulliset lähetykset tai yöpelit. Kaikkien kanavien ohjelmatietoja ei vielä julkaista koko jaksolle.</p><button type="button" id="show-all">Näytä kaikki tulevat ottelut</button></div>
<div id="game-list">${sections}</div>
<noscript><p class="notice">Näytetään primetime-pelit ilmaiskanavilta. Suodattimien muuttaminen vaatii JavaScriptin.</p></noscript>
</section>
</main><footer><p>Ottelun alkamisaika tulee NHL:ltä. Kanavan studio tai lähetys voi alkaa jo aiemmin. Ilmaiskanava tarkoittaa maksutonta TV-lähetystä; saman kanavan verkkokatselu voi vaatia tilauksen.</p><p>Päivitetty <time id="updated" datetime="${escapeHtml(generatedAt)}">${timestampLabel(generatedAt)}</time></p></footer></div></body></html>`;
}
