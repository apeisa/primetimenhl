import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function request(url, options = {}) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        ...options, signal: AbortSignal.timeout(25_000),
        headers: { 'user-agent': 'NHL-Suomessa/1.0 (public schedule aggregator)', ...options.headers },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} (${new URL(url).hostname})`);
      return await response.text();
    } catch (error) {
      last = error;
      // Some broadcaster servers omit an intermediate certificate. curl uses the
      // platform's trust store and verifies TLS normally; never disable verification.
      if ((!options.method || options.method === 'GET')
          && ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(error.cause?.code)) {
        const { stdout } = await execFileAsync('curl', [
          '--fail', '--silent', '--show-error', '--location', '--max-time', '25',
          '--proto', '=https', '--proto-redir', '=https', '--', url,
        ], { maxBuffer: 16 * 1024 * 1024 });
        return stdout;
      }
    }
  }
  throw last;
}

// Cache parsed, validated source results, not a successful HTTP response with a broken schema.
export async function cachedSource(id, cacheDir, loader, { offline = false, now = new Date() } = {}) {
  await mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, `${id}.json`);
  let cache;
  try { cache = JSON.parse(await readFile(path, 'utf8')); } catch {}
  if (!offline) {
    try {
      const value = await loader();
      const result = { ...value, fetchedAt: now.toISOString() };
      await writeFile(path, JSON.stringify(result, null, 2));
      return { ...result, status: 'ok' };
    } catch (error) {
      if (!cache) return { status: 'error', fetchedAt: null, items: [], error: error.message };
      return { ...cache, status: 'cached', error: error.message };
    }
  }
  if (!cache) return { status: 'error', fetchedAt: null, items: [], error: 'Välimuistia ei ole' };
  return { ...cache, status: 'cached' };
}

export async function mapLimit(values, limit, fn) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await fn(values[index], index);
    }
  }));
  return results;
}

export function unique(items, key = x => createHash('sha256').update(JSON.stringify(x)).digest('hex')) {
  return [...new Map(items.map(item => [key(item), item])).values()];
}
