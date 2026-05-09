/**
 * Procesa el dataset "presidentes-vecinales-direccion-y-contacto".
 * - Lee 2 archivos: vecinales.csv (barrio, presidente, telefono, vecinal) +
 *   comisiones-vecinales.csv (vecinal, presidente, vicepresidente, vocal_1..6).
 * - KPIs: total comisiones, miembros, presidentas mujeres, comisiones con sede.
 * - Charts: miembros por vecinal, con/sin sede.
 * - Tabla: directorio completo.
 */

const {
  readCSV,
  countBy,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  formatPercentAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'gobierno/comisiones-vecinales';
const CKAN_ID = 'presidentes-vecinales-direccion-y-contacto';

// Heurística simple: nombres femeninos comunes (lista corta para no hacer NLP)
const NOMBRES_FEMENINOS_COMUNES = new Set([
  'maria', 'ana', 'silvia', 'laura', 'ines', 'inés', 'patricia', 'graciela', 'rosa',
  'cristina', 'monica', 'mónica', 'sandra', 'beatriz', 'claudia', 'mirta', 'mirtha',
  'liliana', 'norma', 'susana', 'elena', 'carmen', 'nelida', 'nélida', 'alicia',
  'marta', 'martha', 'estela', 'gloria', 'mabel', 'olga', 'teresa', 'gabriela',
  'andrea', 'carolina', 'natalia', 'romina', 'cecilia', 'verónica', 'veronica',
  'paola', 'lucia', 'lucía', 'florencia', 'analia', 'analía', 'rocio', 'rocío',
  'soledad', 'fernanda', 'valeria', 'mariana', 'agostina', 'camila', 'micaela',
  'nora', 'velia', 'mara',
]);

function detectGenero(nombre) {
  if (!nombre) return 'desconocido';
  const primero = nombre.toLowerCase().split(/[\s,]+/)[0];
  return NOMBRES_FEMENINOS_COMUNES.has(primero) ? 'femenino' : 'no-detectado';
}

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const vecRes = ds.resources.find((r) => /[-_/]vecinales\.csv$/i.test(r.local_path));
  const comRes = ds.resources.find((r) => /comisiones-vecinales\.csv$/i.test(r.local_path));

  if (!vecRes) throw new Error('No se encontró el archivo de vecinales');
  if (!comRes) console.warn('  ⚠ No se encontró el archivo de comisiones — solo se contarán presidentes');

  // Archivo 1: presidentes y direcciones
  const presidentes = readCSV(localPath(vecRes)).map((r) => ({
    barrio: String(r.barrio || '').trim(),
    presidente: String(r.nombre_apellido_presidente || '').trim(),
    telefono: String(r.telefono || '').trim(),
    direccion: String(r.vecinal || '').trim(),
  })).filter((r) => r.barrio);

  // Archivo 2: comisiones completas (presidente + vicepresidente + 6 vocales)
  const comisiones = comRes
    ? readCSV(localPath(comRes)).map((r) => ({
        vecinal: String(r.vecinal || '').trim(),
        presidente: String(r.presidente || '').trim(),
        vicepresidente: String(r.vicepresidente || '').trim(),
        vocales: ['vocal_1', 'vocal_2', 'vocal_3', 'vocal_4', 'vocal_5', 'vocal_6']
          .map((k) => String(r[k] || '').trim())
          .filter(Boolean),
      })).filter((r) => r.vecinal)
    : [];

  console.log(`    presidentes: ${presidentes.length}, comisiones: ${comisiones.length}`);

  // ─── KPIs ───
  const totalComisiones = presidentes.length;

  let totalMiembros = 0;
  for (const c of comisiones) {
    totalMiembros += 1; // presidente
    if (c.vicepresidente) totalMiembros += 1;
    totalMiembros += c.vocales.length;
  }

  const conSede = presidentes.filter((p) => p.direccion && p.direccion !== 'No tiene' && p.direccion !== '-').length;

  const presidentas = presidentes.filter((p) => detectGenero(p.presidente) === 'femenino').length;
  const pctPresidentas = totalComisiones > 0 ? (presidentas / totalComisiones) * 100 : 0;

  const kpis = [
    buildKPI({
      id: 'total-comisiones',
      label: 'Vecinales activas',
      value: totalComisiones,
      formatted: formatNumberAR(totalComisiones),
      unit: 'comisiones',
    }),
    buildKPI({
      id: 'total-miembros',
      label: 'Miembros de comisiones',
      value: totalMiembros,
      formatted: formatNumberAR(totalMiembros),
      hint: 'Presidentes, vicepresidentes y vocales en total.',
    }),
    buildKPI({
      id: 'con-sede',
      label: 'Comisiones con sede física',
      value: conSede,
      formatted: formatNumberAR(conSede),
      hint: `${formatPercentAR((conSede / Math.max(totalComisiones, 1)) * 100, 0)} del total`,
    }),
    buildKPI({
      id: 'presidentas',
      label: 'Presidentas mujeres',
      value: pctPresidentas,
      formatted: formatPercentAR(pctPresidentas, 1),
      hint: `${formatNumberAR(presidentas)} de ${formatNumberAR(totalComisiones)} (estimado por nombre).`,
    }),
  ];

  // ─── Charts ───

  // 1. Miembros por vecinal
  const miembrosPorVecinal = comisiones.map((c) => ({
    vecinal: c.vecinal.length > 22 ? c.vecinal.slice(0, 20) + '…' : c.vecinal,
    miembros: 1 + (c.vicepresidente ? 1 : 0) + c.vocales.length,
  })).sort((a, b) => b.miembros - a.miembros);

  // 2. Con/sin sede
  const sedeData = [
    { id: 'Con sede física', label: 'Con sede física', value: conSede },
    { id: 'Sin sede', label: 'Sin sede', value: totalComisiones - conSede },
  ].filter((d) => d.value > 0);

  const charts = [];

  if (miembrosPorVecinal.length > 0) {
    charts.push({
      id: 'miembros-por-vecinal',
      type: 'horizontalBar',
      title: 'Miembros de comisión por vecinal',
      subtitle: 'Cantidad total de integrantes (presidente + vicepresidente + vocales).',
      data: miembrosPorVecinal,
      config: { indexBy: 'vecinal', keys: ['miembros'] },
    });
  }

  if (sedeData.length > 0) {
    charts.push({
      id: 'sede',
      type: 'pie',
      title: 'Comisiones con sede física',
      subtitle: 'Vecinales que cuentan con un local declarado para reuniones y atención.',
      data: sedeData,
      config: {},
    });
  }

  // ─── Tabla: directorio ───
  const tableRows = presidentes
    .sort((a, b) => a.barrio.localeCompare(b.barrio))
    .map((p) => [
      p.barrio,
      p.presidente || '—',
      p.telefono || '—',
      p.direccion && p.direccion !== 'No tiene' ? p.direccion : '—',
    ]);

  const tables = [
    {
      id: 'directorio',
      title: 'Directorio de vecinales',
      columns: ['Barrio', 'Presidente/a', 'Teléfono', 'Sede'],
      rows: tableRows,
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Comisiones Vecinales',
      category: 'gobierno',
      description:
        'Listado de comisiones vecinales de Venado Tuerto: presidente, vicepresidente, vocales, contacto y sede de cada barrio.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ totalComisiones, totalMiembros, conSede, pctPresidentas, presidentas });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function renderMarkdown({ totalComisiones, totalMiembros, conSede, pctPresidentas, presidentas }) {
  return `## Resumen

Venado Tuerto cuenta con **${formatNumberAR(totalComisiones)} comisiones vecinales** activas, una por barrio o sector. En total, **${formatNumberAR(totalMiembros)} vecinos** participan como presidentes, vicepresidentes o vocales en estas comisiones.

## Sedes y contacto

**${formatNumberAR(conSede)}** comisiones cuentan con una sede física declarada para reuniones y atención al vecindario. El resto opera de manera itinerante o utiliza espacios cedidos por la municipalidad.

## Participación femenina

Aproximadamente **${formatPercentAR(pctPresidentas, 0)}** de las presidencias vecinales (${formatNumberAR(presidentas)} de ${formatNumberAR(totalComisiones)}) están a cargo de mujeres, según una estimación a partir del primer nombre del titular. Esta cifra puede subestimar el total real si algunas presidentas usan formas masculinas o ambiguas como nombre.

## Marco institucional

Las comisiones vecinales son organizaciones de base reconocidas por el municipio, electas en elecciones vecinales periódicas. Funcionan como nexo entre los vecinos del barrio y el gobierno local, articulando demandas de obras, servicios y actividades comunitarias.

## Sobre los datos

El dataset combina dos fuentes: el registro de presidentes con dirección y teléfono de contacto, y el listado completo de comisiones con todos sus integrantes (presidente + vicepresidente + 6 vocales por comisión).
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
