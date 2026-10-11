import { CHANNELS } from './match.mjs';
import { dateLabel, timestampLabel, addDays, localParts } from './time.mjs';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol) ? escapeHtml(value) : '#'; } catch { return '#'; } };

function gameRow(game, index) {
  const broadcasts = [...game.broadcasts].sort((a, b) => Number(CHANNELS[b.channel].free) - Number(CHANNELS[a.channel].free));
  const badges = broadcasts.map(b => `<a class="channel ${CHANNELS[b.channel].free ? 'channel-free' : 'channel-paid'}" href="${safeUrl(b.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(CHANNELS[b.channel].name)}: avaa ohjelmatiedot">${escapeHtml(CHANNELS[b.channel].name)}<span aria-hidden="true">↗</span></a>`).join('');
  const scheduled = game.scheduleState !== 'OK';
  return `<li class="game" data-game data-start="${escapeHtml(game.startTimeUTC)}" data-free="${game.free}" data-primetime="${game.primetime}" data-channels="${broadcasts.map(b => b.channel).join(',')}" ${game.free && game.primetime ? '' : 'hidden'}>
    <div class="game-time"><time datetime="${escapeHtml(game.startTimeUTC)}" title="${timestampLabel(game.startTimeUTC)} Suomen aikaa">${escapeHtml(game.time)}</time><span>${game.primetime ? 'PRIMETIME' : 'YÖPELI'}</span></div>
    <div class="matchup"><div class="teams"><a href="${safeUrl(game.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(game.away.name)}<span class="versus">–</span>${escapeHtml(game.home.name)}</a></div><div class="game-meta">${scheduled ? '<span class="pending">Ajankohta vahvistamatta</span>' : game.broadcasts.length ? `${game.free ? '<span class="free-dot"></span>Ilmaiskanavalla' : 'Maksullinen lähetys'}${broadcasts.some(b => b.manual) ? ' · käsin vahvistettu' : ''}` : '<span class="pending">Suomen lähetystieto ei vielä vahvistettu</span>'}</div></div>
    <div class="channels">${badges || '<span class="unknown">Odottaa ohjelmatietoja</span>'}</div>
    <span class="row-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
  </li>`;
}

export function render({ games, sources, generatedAt, days }) {
  const now = new Date(generatedAt);
  const groups = new Map();
  for (const game of games) {
    if (!groups.has(game.viewingDate)) groups.set(game.viewingDate, []);
    groups.get(game.viewingDate).push(game);
  }
  const shown = games.filter(g => g.free && g.primetime);
  let index = 0;
  const sections = [...groups].map(([date, items]) => `<section class="day" data-day ${items.some(g => g.free && g.primetime) ? '' : 'hidden'}>
    <div class="day-heading"><h2>${escapeHtml(dateLabel(date))}</h2><span class="day-count">${items.filter(g => g.free && g.primetime).length} ottelua</span></div>
    <ul class="games">${items.map(game => gameRow(game, index++)).join('')}</ul>
  </section>`).join('');
  const statusNames = { ok: 'Päivitetty', cached: 'Välimuistista', expired: 'Vanhentunut', error: 'Haku epäonnistui' };
  const sourcesHtml = sources.map(source => `<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)} ↗</a><span class="source-status ${source.status === 'ok' ? '' : 'source-warning'}">${statusNames[source.status]}${source.fetchedAt ? ` ${timestampLabel(source.fetchedAt)}` : ''}${source.coverageThrough ? ` · opas ${escapeHtml(source.coverageThrough.split('-').reverse().slice(0, 2).join('.'))}. asti` : ''}</span></li>`).join('');
  const warnings = sources.filter(s => s.status !== 'ok');
  const lastDate = addDays(localParts(now).date, days - 1);
  return `<!doctype html>
<html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Primetime NHL — NHL-ottelut Suomessa</title><meta name="description" content="Tulevat NHL-ottelut Suomen aikaan. Löydä primetime-pelit ja ilmaiset lähetykset MTV Subilta, Star Channelilta ja Viaplay TV:stä."><link rel="icon" href="./favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./styles.css"><script src="./filters.js" defer></script></head>
<body><a class="skip-link" href="#ottelut">Siirry otteluihin</a><div class="shell">
<header class="site-header"><a class="brand" href="./" aria-label="Primetime NHL etusivu"><svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="11" fill="currentColor"/><path d="M12 12v16m0-16 16 16V12" fill="none" stroke="#fff" stroke-width="3"/><circle cx="29" cy="29" r="3" fill="#bcebcc"/></svg><span>PRIMETIME<span class="brand-secondary">NHL</span></span></a><div class="header-note"><span class="status-dot"></span>SUOMEN AIKA · EET / EEST</div></header>
<main>
<section class="hero" aria-labelledby="title"><div class="hero-content"><p class="eyebrow">KIEKKOILTA ILMAN YÖVUOROA</p><h1 id="title">NHL, ihmisten<br><em>aikaan.</em></h1><p class="intro">Tulevat ottelut ja mistä ne näkee Suomessa.<br>Ilmaiskanavat ja ennen yöunia alkavat pelit ensin.</p><div class="hero-bottom"><span class="period">SEURAAVAT ${days} PÄIVÄÄ</span><span>${dateLabel(localParts(now).date).split(' ').slice(1).join(' ')} – ${dateLabel(lastDate).split(' ').slice(1).join(' ')}</span></div></div><div class="hero-art" aria-hidden="true"><div class="rink"><div class="rink-line"></div><div class="rink-center"></div><div class="rink-circle circle-left"></div><div class="rink-circle circle-right"></div><div class="puck"></div><span class="rink-label">FI / NHL</span></div><span class="art-caption">HYVÄÄ KIEKKOA. SOPIVAAN AIKAAN.</span></div></section>
<section class="schedule" id="ottelut" aria-labelledby="schedule-title">
<div class="schedule-heading"><div><p class="eyebrow">OTTELUOHJELMA</p><h2 id="schedule-title">Seuraavat kiekkoillat</h2></div><span class="total-count" id="result-count" role="status" aria-live="polite">${shown.length} ottelua</span></div>
<form class="filters" aria-label="Suodata otteluita"><label class="toggle"><input id="primetime" name="primetime" type="checkbox" checked><span class="switch" aria-hidden="true"></span><span>Primetime <small>Viimeistään klo 24.00</small></span></label><label class="toggle"><input id="free-only" name="free" type="checkbox" checked><span class="switch" aria-hidden="true"></span><span>Vain ilmaiskanavat <small>Sub · Star · Viaplay TV</small></span></label><div class="channel-select"><label for="channel">Kanava / palvelu</label><select id="channel" name="channel"><option value="all">Kaikki kanavat</option>${Object.entries(CHANNELS).map(([id, c]) => `<option value="${id}">${escapeHtml(c.name)}</option>`).join('')}</select></div></form>
<p class="filter-note">Ajat ovat Suomen aikaa. Klo 24.00 kuuluu edellisen päivän iltaan. Uusintoja ei näytetä.</p>
${warnings.length ? `<div class="notice" role="status">Kaikkia tietoja ei saatu päivitettyä. Tarkista lähteiden tilanne sivun lopusta.</div>` : ''}
<div class="notice" id="stale-notice" hidden>Tämä sivu on päivitetty yli vuorokausi sitten. Tarkista lähetys kanavan ohjelmaoppaasta.</div>
<div class="empty-state" id="empty-state" ${shown.length ? 'hidden' : ''}><span class="empty-icon" aria-hidden="true">↗</span><h3>Ei otteluita näillä suodattimilla</h3><p>Kokeile näyttää myös maksulliset lähetykset tai yöpelit. Kaikkien kanavien ohjelmatietoja ei vielä julkaista koko jaksolle.</p><button type="button" id="show-all">Näytä kaikki tulevat ottelut</button></div>
<div id="game-list">${sections}</div>
<noscript><p class="notice">Näytetään primetime-pelit ilmaiskanavilta. Suodattimien muuttaminen vaatii JavaScriptin.</p></noscript>
</section>
<section class="about" aria-labelledby="about-title"><div><p class="eyebrow">HYVÄ TIETÄÄ</p><h2 id="about-title">Peli alkaa.<br>Opas elää.</h2></div><div class="about-copy"><p>Ottelun alkamisaika tulee NHL:ltä. Kanavan studio tai lähetys voi alkaa jo aiemmin. Ilmaiskanava tarkoittaa maksutonta TV-lähetystä; saman kanavan verkkokatselu voi vaatia tilauksen.</p><p>Ohjelmaoppaat täydentyvät eri tahtiin. Puuttuva lähetystieto ei tarkoita, ettei ottelua näytettäisi Suomessa. Disney+:n ottelut lisätään toistaiseksi käsin vahvistetuista lähteistä.</p><details><summary>Tietolähteet ja päivitykset</summary><ul class="sources">${sourcesHtml}</ul><p class="source-footnote">Ilmaislähetys merkitään vain otteluun yhdistetyn ohjelmatiedon perusteella. Yli 48 tuntia vanhaa kanavatietoa ei näytetä vahvistettuna.</p></details></div></section>
</main><footer><span>PRIMETIME NHL <span class="footer-separator">/</span> RIIPPUMATON OTTELUOPAS</span><span>Päivitetty <time id="updated" datetime="${escapeHtml(generatedAt)}">${timestampLabel(generatedAt)}</time></span></footer></div></body></html>`;
}
