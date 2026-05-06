/**
 * Utilidades compartidas para los scripts de procesamiento.
 *
 * - readCSV(path): parseo robusto con papaparse (delimitador auto, headers).
 * - parseSpanishNumber: maneja "1.234,56" → 1234.56.
 * - parseDDMMYYYY: maneja "12/2/1997" → Date.
 * - groupBy / countBy / sumBy: helpers de agregación.
 * - mergeYearly: combina archivos por año en un único array con campo `anio`.
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function readCSV(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`CSV no encontrado: ${absolute}`);
  }
  const text = fs.readFileSync(absolute, 'utf8');
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => String(h || '').trim(),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  });
  if (parsed.errors && parsed.errors.length > 0) {
    const fatal = parsed.errors.filter((e) => e.type !== 'FieldMismatch');
    if (fatal.length > 0) {
      console.warn(`  ⚠ ${fatal.length} errores de parseo en ${path.basename(absolute)}`);
    }
  }
  return parsed.data;
}

function parseSpanishNumber(s) {
  if (s === null || s === undefined || s === '') return NaN;
  if (typeof s === 'number') return s;
  // "1.234,56" → 1234.56  ;  "1234,56" → 1234.56  ;  "1234.56" → 1234.56
  const cleaned = String(s).replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Extrae el ÚLTIMO año (20XX) que aparece en una ruta/filename.
 * Necesario porque los slugs CKAN suelen tener un año del nombre del dataset
 * (ej: "...rapida-2024-cdr-2025.csv") y queremos el del archivo, no el del slug.
 */
function extractYearFromPath(p) {
  const matches = String(p).match(/20\d{2}/g);
  return matches ? Number(matches[matches.length - 1]) : null;
}

function parseDDMMYYYY(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

function countBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

function sumBy(arr, valueFn) {
  let total = 0;
  for (const item of arr) {
    const v = valueFn(item);
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

function topN(map, n = 10, sortDesc = true) {
  const entries = [...map.entries()];
  entries.sort((a, b) => (sortDesc ? b[1] - a[1] : a[1] - b[1]));
  return entries.slice(0, n);
}

function mergeYearly(files, yearExtractor) {
  const all = [];
  for (const f of files) {
    const rows = readCSV(f);
    const anio = yearExtractor(f);
    for (const r of rows) all.push({ ...r, anio });
  }
  return all;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJSON(outPath, data) {
  const absolute = path.isAbsolute(outPath) ? outPath : path.join(PROJECT_ROOT, outPath);
  ensureDir(path.dirname(absolute));
  fs.writeFileSync(absolute, JSON.stringify(data, null, 2), 'utf8');
}

function writeMarkdown(outPath, md) {
  const absolute = path.isAbsolute(outPath) ? outPath : path.join(PROJECT_ROOT, outPath);
  ensureDir(path.dirname(absolute));
  fs.writeFileSync(absolute, md, 'utf8');
}

function loadManifest() {
  const p = path.join(PROJECT_ROOT, 'data', 'manifest.json');
  if (!fs.existsSync(p)) {
    throw new Error(`Manifest no encontrado en ${p}. Ejecutá primero: npm run download`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function findDataset(manifest, ckanId) {
  const ds = manifest.datasets.find((d) => d.id === ckanId);
  if (!ds) {
    throw new Error(`Dataset ${ckanId} no encontrado en manifest.json`);
  }
  return ds;
}

function localPath(resource) {
  return path.join(PROJECT_ROOT, resource.local_path);
}

function formatNumberAR(n, decimals = 0) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercentAR(n, decimals = 1) {
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function formatCurrencyARS(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function buildKPI({ id, label, value, formatted, unit, status, hint }) {
  return {
    id,
    label,
    value,
    formatted: formatted !== undefined ? formatted : formatNumberAR(value),
    ...(unit ? { unit } : {}),
    ...(status ? { status } : {}),
    ...(hint ? { hint } : {}),
  };
}

function buildMeta({ id, title, category, description, manifestEntry }) {
  return {
    id,
    title,
    category,
    description: description || manifestEntry?.notes || '',
    source: manifestEntry?.source_url || '',
    license: manifestEntry?.license || 'CC-BY',
    last_updated: manifestEntry?.last_updated || new Date().toISOString(),
    organization: manifestEntry?.organization || '',
  };
}

module.exports = {
  PROJECT_ROOT,
  readCSV,
  parseSpanishNumber,
  extractYearFromPath,
  parseDDMMYYYY,
  groupBy,
  countBy,
  sumBy,
  topN,
  mergeYearly,
  ensureDir,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  formatPercentAR,
  formatCurrencyARS,
  buildKPI,
  buildMeta,
};
