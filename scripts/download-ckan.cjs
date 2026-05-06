#!/usr/bin/env node
/**
 * Descarga masiva de datasets desde el portal CKAN de Venado Tuerto.
 * Fuente: https://datos-abiertos.venadotuerto.gob.ar/
 *
 * Uso:
 *   node scripts/download-ckan.cjs            # descarga real
 *   node scripts/download-ckan.cjs --dry-run  # solo lista, no baja archivos
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const CKAN_BASE = 'https://datos-abiertos.venadotuerto.gob.ar';
const USER_AGENT = 'Dashboard-VenadoTuerto-OpenArg/1.0 (open-data downloader)';
const CONCURRENCY = 4;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 60_000;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');
const CKAN_RAW_PATH = path.join(DATA_DIR, '_ckan_raw_response.json');
const GROUPS_RAW_PATH = path.join(DATA_DIR, '_ckan_groups.json');

const DRY_RUN = process.argv.includes('--dry-run');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'sin-nombre';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, { json = false, asResponse = false } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: json ? 'application/json' : '*/*' },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      if (asResponse) return res;
      if (json) return await res.json();
      return await res.arrayBuffer();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const backoff = 1000 * 2 ** (attempt - 1);
        log(`${ANSI.yellow}  retry ${attempt}/${MAX_RETRIES} after ${backoff}ms: ${err.message}${ANSI.reset}`);
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}

async function downloadToFile(url, destPath) {
  const res = await fetchWithRetry(url, { asResponse: true });
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  const out = fs.createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body), out);
}

function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const s = fs.createReadStream(filePath);
    s.on('data', (chunk) => hash.update(chunk));
    s.on('end', () => resolve(hash.digest('hex')));
    s.on('error', reject);
  });
}

async function fileSize(filePath) {
  try {
    const st = await fsp.stat(filePath);
    return st.size;
  } catch {
    return null;
  }
}

function pickCategory(pkg, knownGroupSlugs) {
  if (Array.isArray(pkg.groups) && pkg.groups.length > 0) {
    const g = pkg.groups[0];
    const slug = slugify(g.name || g.title);
    if (slug) return slug;
  }
  if (pkg.organization && pkg.organization.name) {
    return slugify(pkg.organization.name);
  }
  return 'sin-categoria';
}

function stripFormatSuffix(slug, formatExt) {
  if (!slug || !formatExt) return slug;
  const re = new RegExp(`-${formatExt}$`);
  return slug.replace(re, '');
}

function pickResourceFilename(resource, datasetId, indexInDataset, total) {
  const formatExt = ((resource.format || 'csv').toLowerCase().replace(/[^a-z0-9]+/g, '')) || 'csv';
  const baseFromName = resource.name ? slugify(resource.name) : null;
  const baseFromUrl = resource.url
    ? slugify(path.basename(new URL(resource.url).pathname).replace(/\.[a-z0-9]+$/i, ''))
    : null;
  let base = stripFormatSuffix(baseFromName, formatExt) || stripFormatSuffix(baseFromUrl, formatExt) || datasetId;
  if (total === 1) {
    base = datasetId;
  } else if (!base.includes(datasetId.split('-').slice(0, 2).join('-'))) {
    base = `${datasetId}-${base}`;
  }
  if (base === datasetId && total > 1) {
    base = `${datasetId}-${indexInDataset + 1}`;
  }
  return `${base}.${formatExt}`;
}

async function pLimit(concurrency, items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { __error: err };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  log(`${ANSI.bold}${ANSI.cyan}== Descarga CKAN — Venado Tuerto ==${ANSI.reset}`);
  log(`Fuente: ${CKAN_BASE}`);
  if (DRY_RUN) log(`${ANSI.yellow}MODO DRY-RUN — no se descargarán archivos${ANSI.reset}`);
  log('');

  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(RAW_DIR, { recursive: true });

  log(`${ANSI.dim}1/3 Consultando lista de paquetes...${ANSI.reset}`);
  const pkgListResp = await fetchWithRetry(
    `${CKAN_BASE}/api/3/action/current_package_list_with_resources?limit=500`,
    { json: true }
  );
  if (!pkgListResp.success) throw new Error('CKAN respondió success=false en package list');
  const packages = pkgListResp.result;
  log(`   ${ANSI.green}OK${ANSI.reset} — ${packages.length} datasets`);

  log(`${ANSI.dim}2/3 Consultando grupos (categorías)...${ANSI.reset}`);
  const groupsResp = await fetchWithRetry(
    `${CKAN_BASE}/api/3/action/group_list?all_fields=true`,
    { json: true }
  );
  const groups = (groupsResp.success && groupsResp.result) || [];
  const groupTitles = {};
  for (const g of groups) groupTitles[slugify(g.name)] = g.title || g.display_name || g.name;
  log(`   ${ANSI.green}OK${ANSI.reset} — ${groups.length} grupos`);

  await fsp.writeFile(CKAN_RAW_PATH, JSON.stringify(pkgListResp, null, 2), 'utf8');
  await fsp.writeFile(GROUPS_RAW_PATH, JSON.stringify(groupsResp, null, 2), 'utf8');

  const downloadJobs = [];
  const datasetEntries = [];
  for (const pkg of packages) {
    const category = pickCategory(pkg, new Set(Object.keys(groupTitles)));
    const datasetId = slugify(pkg.name || pkg.id);
    const resources = Array.isArray(pkg.resources) ? pkg.resources : [];
    const resourceEntries = [];
    resources.forEach((res, i) => {
      if (!res.url) return;
      const filename = pickResourceFilename(res, datasetId, i, resources.length);
      const localRel = path.posix.join('data', 'raw', category, filename);
      const localAbs = path.join(PROJECT_ROOT, localRel);
      const entry = {
        ckan_resource_id: res.id,
        name: res.name || filename,
        format: (res.format || '').toUpperCase() || null,
        description: res.description || null,
        created: res.created || null,
        last_modified: res.last_modified || res.metadata_modified || null,
        url: res.url,
        local_path: localRel,
        size_bytes: null,
        sha256: null,
      };
      resourceEntries.push(entry);
      downloadJobs.push({ url: res.url, dest: localAbs, entry, datasetId });
    });
    datasetEntries.push({
      id: datasetId,
      title: pkg.title || datasetId,
      category,
      category_label: groupTitles[category] || category,
      organization: pkg.organization ? pkg.organization.title || pkg.organization.name : null,
      organization_slug: pkg.organization ? slugify(pkg.organization.name) : null,
      license: pkg.license_title || pkg.license_id || null,
      notes: pkg.notes || null,
      tags: Array.isArray(pkg.tags) ? pkg.tags.map((t) => t.display_name || t.name) : [],
      created: pkg.metadata_created || null,
      last_updated: pkg.metadata_modified || null,
      source_url: `${CKAN_BASE}/dataset/${pkg.name}`,
      resources: resourceEntries,
    });
  }

  log('');
  log(`${ANSI.dim}3/3 ${DRY_RUN ? 'Simulando' : 'Descargando'} ${downloadJobs.length} archivos (${CONCURRENCY} en paralelo)...${ANSI.reset}`);
  log('');

  let nDownloaded = 0;
  let nSkipped = 0;
  let nFailed = 0;
  const failures = [];

  const startTs = Date.now();
  await pLimit(CONCURRENCY, downloadJobs, async (job, idx) => {
    const tag = `[${String(idx + 1).padStart(3, ' ')}/${downloadJobs.length}]`;
    const shortPath = path.relative(PROJECT_ROOT, job.dest).replace(/\\/g, '/');
    if (DRY_RUN) {
      log(`${tag} ${ANSI.dim}skip (dry-run) → ${shortPath}${ANSI.reset}`);
      return;
    }
    try {
      const existingSize = await fileSize(job.dest);
      if (existingSize !== null && existingSize > 0) {
        const existingHash = await sha256OfFile(job.dest);
        job.entry.size_bytes = existingSize;
        job.entry.sha256 = existingHash;
        nSkipped++;
        log(`${tag} ${ANSI.dim}exists (${existingSize} B) ${shortPath}${ANSI.reset}`);
        return;
      }
      await downloadToFile(job.url, job.dest);
      const size = await fileSize(job.dest);
      const hash = await sha256OfFile(job.dest);
      job.entry.size_bytes = size;
      job.entry.sha256 = hash;
      nDownloaded++;
      log(`${tag} ${ANSI.green}OK${ANSI.reset} ${size} B  ${shortPath}`);
    } catch (err) {
      nFailed++;
      failures.push({ url: job.url, dest: shortPath, error: err.message });
      log(`${tag} ${ANSI.red}FAIL${ANSI.reset} ${shortPath} — ${err.message}`);
    }
  });

  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);

  const totalBytes = datasetEntries
    .flatMap((d) => d.resources)
    .reduce((acc, r) => acc + (r.size_bytes || 0), 0);

  const manifest = {
    source: `${CKAN_BASE}/`,
    api: `${CKAN_BASE}/api/3/action/current_package_list_with_resources`,
    fetched_at: new Date().toISOString(),
    ckan_version: '2.10',
    license_note: 'Datos publicados por la Municipalidad de Venado Tuerto bajo licencias abiertas (CC-BY / ODC-BY). Citar la fuente al reutilizar.',
    total_datasets: datasetEntries.length,
    total_files: downloadJobs.length,
    total_bytes: totalBytes,
    groups: groupTitles,
    datasets: datasetEntries.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.id.localeCompare(b.id);
    }),
  };

  if (!DRY_RUN) {
    await fsp.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  }

  log('');
  log(`${ANSI.bold}== Resumen ==${ANSI.reset}`);
  log(`Datasets:        ${datasetEntries.length}`);
  log(`Archivos:        ${downloadJobs.length}`);
  log(`  ${ANSI.green}descargados:${ANSI.reset}   ${nDownloaded}`);
  log(`  ${ANSI.dim}ya existían:${ANSI.reset}   ${nSkipped}`);
  log(`  ${ANSI.red}fallidos:${ANSI.reset}      ${nFailed}`);
  log(`Bytes totales:   ${(totalBytes / 1024).toFixed(1)} KB`);
  log(`Tiempo:          ${elapsed}s`);
  log(`Manifest:        ${path.relative(PROJECT_ROOT, MANIFEST_PATH).replace(/\\/g, '/')}`);

  if (failures.length > 0) {
    log('');
    log(`${ANSI.red}${ANSI.bold}Fallos:${ANSI.reset}`);
    for (const f of failures) log(`  - ${f.dest}\n    ${f.url}\n    ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  log(`${ANSI.red}${ANSI.bold}ERROR:${ANSI.reset} ${err.stack || err.message}`);
  process.exit(1);
});
