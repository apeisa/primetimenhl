import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, X509Certificate } from 'node:crypto';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { get as httpsGet } from 'node:https';
import { rootCertificates } from 'node:tls';

const execFileAsync = promisify(execFile);

export function verifiedCertificateChain(intermediates) {
  const roots = rootCertificates.map(pem => new X509Certificate(pem));
  for (const pem of intermediates) {
    const cert = new X509Certificate(pem);
    const issuer = roots.find(root => cert.checkIssued(root) && cert.verify(root.publicKey));
    if (!cert.ca || !issuer || Date.parse(cert.validTo) < Date.now() || Date.parse(cert.validFrom) > Date.now()) {
      throw new Error('Välivarmenne ei ole voimassa tai luotetun juurivarmenteen allekirjoittama');
    }
  }
  return [...rootCertificates, ...intermediates];
}

function requestWithChain(url, chain) {
  if (new URL(url).protocol !== 'https:') throw new Error('Varmenneketjua käytetään vain HTTPS-yhteyksille');
  const ca = verifiedCertificateChain(chain);
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, { ca, rejectUnauthorized: true, timeout: 25_000,
      headers: { 'user-agent': 'Primetime/1.0' },
    }, response => {
      if (response.statusCode !== 200) {
        response.resume(); reject(new Error(`HTTP ${response.statusCode} (${new URL(url).hostname})`)); return;
      }
      const chunks = [];
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 16 * 1024 * 1024) response.destroy(new Error('Lähdevastaus ylittää kokorajan'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('HTTPS-haku aikakatkaistiin')));
    req.on('error', reject);
  });
}

export async function request(url, options = {}) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (options.intermediateCertificates) return await requestWithChain(url, options.intermediateCertificates);
      const response = await fetch(url, {
        ...options, signal: AbortSignal.timeout(25_000),
        headers: { 'user-agent': 'Primetime/1.0', ...options.headers },
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
