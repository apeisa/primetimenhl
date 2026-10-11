import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, cp, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cachedSource } from './http.mjs';
import { localParts } from './time.mjs';
import { fetchNhl } from './sources/nhl.mjs';
import { fetchStar, STAR_URL } from './sources/star.mjs';
import { fetchMtv, MTV_URL } from './sources/mtv.mjs';
import { fetchViaplayTv, VIAPLAYTV_URL } from './sources/viaplaytv.mjs';
import { fetchViaplay, VIAPLAY_URL } from './sources/viaplay.mjs';
import { matchBroadcasts, applyOverrides, upcomingGames } from './match.mjs';
import { render } from './render.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const now = new Date(process.env.BUILD_NOW ?? Date.now());
if (!Number.isFinite(now.getTime())) throw new Error('Virheellinen BUILD_NOW');
const days = Number(process.env.SCHEDULE_DAYS ?? 14);
if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error('SCHEDULE_DAYS pitää olla 1–31');
const date = localParts(now).date;
const options = { offline: process.argv.includes('--offline'), now };
const context = { date, days };
const definitions = [
  { id: 'nhl', name: 'NHL', url: 'https://www.nhl.com/schedule', loader: fetchNhl },
  { id: 'sub', name: 'MTV Sub', url: MTV_URL, loader: fetchMtv },
  { id: 'star', name: 'Star Channel', url: STAR_URL, loader: fetchStar },
  { id: 'viaplaytv', name: 'Viaplay TV', url: VIAPLAYTV_URL, loader: fetchViaplayTv },
  { id: 'viaplay', name: 'Viaplay', url: VIAPLAY_URL, loader: fetchViaplay },
];
const results = await Promise.all(definitions.map(async definition => {
  const result = await cachedSource(definition.id, join(root, '.cache'), () => definition.loader(context), options);
  const age = result.fetchedAt ? now.getTime() - Date.parse(result.fetchedAt) : Infinity;
  if (result.status === 'cached' && age > 48 * 3_600_000) result.status = 'expired';
  console.log(`${definition.name}: ${result.status}, ${result.items.length} tietuetta${result.error ? ` (${result.error})` : ''}`);
  return { ...result, id: definition.id, name: definition.name, url: definition.url };
}));
const nhl = results[0];
if (!nhl.items.length || nhl.status === 'expired') {
  throw new Error('Tuoretta NHL-otteluohjelmaa ei ole. Edellistä sivua ei korvata.');
}
const broadcasts = results.slice(1).filter(source => !['expired', 'error'].includes(source.status))
  .flatMap(source => source.items.map(b => ({ ...b, sourceFetchedAt: source.fetchedAt, sourceStatus: source.status })));
const { games: matched, unmatched } = matchBroadcasts(nhl.items, broadcasts);
const overrides = JSON.parse(await readFile(join(root, 'data/overrides.json'), 'utf8'));
const games = upcomingGames(applyOverrides(matched, overrides), { now, days });
const sources = results.map(({ items, ...source }) => source);
const data = { generatedAt: now.toISOString(), days, games, sources };
const staging = join(root, '.dist-build');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(join(root, 'public'), staging, { recursive: true });
const assets = await Promise.all(['styles.css', 'filters.js', 'theme.js'].map(file => readFile(join(root, 'public', file))));
const assetVersion = createHash('sha256').update(Buffer.concat(assets)).digest('hex').slice(0, 12);
await writeFile(join(staging, 'index.html'), render({ ...data, assetVersion }));
const worker = await readFile(join(root, 'public/sw.js'), 'utf8');
await writeFile(join(staging, 'sw.js'), worker.replaceAll('__ASSET_VERSION__', assetVersion));
await writeFile(join(staging, 'games.json'), JSON.stringify(data, null, 2));
await writeFile(join(root, '.cache/match-report.json'), JSON.stringify({ generatedAt: data.generatedAt, unmatched }, null, 2));
await rm(join(root, 'dist'), { recursive: true, force: true });
await rename(staging, join(root, 'dist'));
console.log(`Valmis: ${games.length} tulevaa ottelua, ${games.filter(g => g.free && g.primetime).length} ilmaista primetime-peliä. ${unmatched.length} yhdistämätöntä ohjelmatietoa.`);
