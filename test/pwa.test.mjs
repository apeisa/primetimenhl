import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const asset = path => readFile(new URL(`../public/${path}`, import.meta.url), 'utf8');

test('theme follows system changes, remembers explicit choice and tolerates blocked storage', async () => {
  const code = await asset('theme.js');
  for (const blocked of [false, true]) {
    let stored;
    const listeners = {};
    const media = { matches: true, addEventListener: (_, callback) => { listeners.system = callback; } };
    const select = { value: '', addEventListener: (_, callback) => { listeners.select = callback; } };
    const meta = {};
    const document = { documentElement: { dataset: {} }, querySelector: selector => selector === '#theme' ? select : meta,
      addEventListener: (_, callback) => { listeners.ready = callback; } };
    vm.runInNewContext(code, { document, window: { matchMedia: () => media }, localStorage: {
      getItem: () => { if (blocked) throw Error('blocked'); return stored; },
      setItem: (_, value) => { if (blocked) throw Error('blocked'); stored = value; }
    } });
    assert.equal(document.documentElement.dataset.theme, 'dark');
    listeners.ready(); assert.equal(select.value, 'system');
    media.matches = false; listeners.system(); assert.equal(document.documentElement.dataset.theme, 'light');
    select.value = 'dark'; listeners.select(); assert.equal(document.documentElement.dataset.theme, 'dark');
    if (!blocked) assert.equal(stored, 'dark');
    media.matches = false; listeners.system(); assert.equal(document.documentElement.dataset.theme, 'dark');
    select.value = 'system'; listeners.select(); assert.equal(document.documentElement.dataset.theme, 'light');
  }
});

test('PWA manifest resolves inside a Pages project and includes actual PNG icons', async () => {
  const manifest = JSON.parse(await asset('manifest.webmanifest'));
  const base = 'https://apeisa.github.io/primetimenhl/manifest.webmanifest';
  assert.equal(new URL(manifest.start_url, base).href, 'https://apeisa.github.io/primetimenhl/');
  assert.equal(manifest.display, 'standalone');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
    const png = await readFile(new URL(`../public/${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});

test('service worker refreshes online, falls back offline, and stays inside its own project', async () => {
  const events = {}, entries = new Map();
  let offline = false, fetches = 0;
  const cache = { put: async (key, value) => entries.set(typeof key === 'string' ? key : key.url, value),
    match: async key => entries.get(typeof key === 'string' ? key : key.url) };
  vm.runInNewContext(await asset('sw.js'), { URL, self: {
    registration: { scope: 'https://example.org/primetimenhl/' }, location: { origin: 'https://example.org' },
    addEventListener: (name, callback) => { events[name] = callback; }
  }, caches: { open: async () => cache }, fetch: async () => {
    fetches++; if (offline) throw Error('offline');
    return { ok: true, type: 'basic', content: fetches, clone() { return { ...this }; } };
  } });
  const request = url => ({ url, mode: 'navigate', method: 'GET' });
  async function visit(url) {
    let response;
    events.fetch({ request: request(url), respondWith: promise => { response = promise; } });
    return response;
  }
  const root = 'https://example.org/primetimenhl/';
  assert.equal((await visit(root)).content, 1);
  assert.equal((await visit(`${root}?free=0`)).content, 2);
  offline = true; assert.equal((await visit(`${root}?primetime=0`)).content, 2);
  assert.equal(await visit('https://example.org/another-project/'), undefined);
  assert.equal(await visit('https://www.nhl.com/'), undefined);
});
