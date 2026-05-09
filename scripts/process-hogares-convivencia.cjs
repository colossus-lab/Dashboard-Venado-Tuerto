/**
 * Procesa el dataset "hogares-de-convivencia".
 * - Lee 1 archivo: 19 hogares con titular, nombre fantasía y dirección.
 * - KPIs: total hogares, propietarios distintos.
 * - Charts: hogares por propietario.
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
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'hacienda-economia/hogares-convivencia';
const CKAN_ID = 'hogares-de-convivencia';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => ({
    titular: String(r.nombre || '').trim(),
    fantasia: String(r.nombre_fantasia || '').trim(),
    direccion: String(r.direccion || '').trim(),
  })).filter((r) => r.titular || r.fantasia);

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const total = rows.length;
  const titularCounts = countBy(
    rows.filter((r) => r.titular),
    (r) => r.titular,
  );
  const propietariosDistintos = titularCounts.size;
  const conMultiples = [...titularCounts.values()].filter((c) => c > 1).length;

  const kpis = [
    buildKPI({
      id: 'total-hogares',
      label: 'Hogares de convivencia',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'hogares',
    }),
    buildKPI({
      id: 'propietarios',
      label: 'Titulares distintos',
      value: propietariosDistintos,
      formatted: formatNumberAR(propietariosDistintos),
      hint: 'Personas o sociedades responsables.',
    }),
    buildKPI({
      id: 'titulares-multiples',
      label: 'Titulares con varios hogares',
      value: conMultiples,
      formatted: formatNumberAR(conMultiples),
      hint: 'Quienes operan más de un hogar registrado.',
    }),
  ];

  // ─── Charts ───

  // Solo si hay titulares con múltiples hogares vale la pena el chart
  const titularData = [...titularCounts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => ({
      titular: t.length > 32 ? t.slice(0, 30) + '…' : t,
      hogares: c,
    }));

  const charts = [];

  if (titularData.length > 0) {
    charts.push({
      id: 'titulares-multi',
      type: 'horizontalBar',
      title: 'Titulares con más de un hogar',
      subtitle: 'Personas o sociedades que operan múltiples hogares de convivencia.',
      data: titularData,
      config: { indexBy: 'titular', keys: ['hogares'] },
    });
  }

  // ─── Tabla: directorio ───
  const tableRows = rows
    .sort((a, b) => (a.fantasia || a.titular).localeCompare(b.fantasia || b.titular))
    .map((r) => [r.fantasia || '—', r.titular || '—', r.direccion || '—']);

  const tables = [
    {
      id: 'directorio',
      title: 'Directorio de hogares de convivencia',
      columns: ['Hogar', 'Titular', 'Dirección'],
      rows: tableRows,
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Hogares de Convivencia',
      category: 'hacienda-economia',
      description:
        'Padrón municipal de hogares de convivencia (residencias geriátricas) habilitados en Venado Tuerto: titular, nombre del establecimiento y dirección.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ total, propietariosDistintos, conMultiples });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function renderMarkdown({ total, propietariosDistintos, conMultiples }) {
  return `## Resumen

El padrón municipal registra **${formatNumberAR(total)} hogares de convivencia** habilitados en Venado Tuerto, operados por **${formatNumberAR(propietariosDistintos)} titulares** distintos. **${formatNumberAR(conMultiples)}** titulares operan más de un hogar.

## Qué son los hogares de convivencia

Los hogares de convivencia son residencias destinadas al alojamiento permanente o transitorio de adultos mayores, personas con discapacidad u otros grupos que requieren cuidados continuos. Se diferencian de las clínicas geriátricas por estar centrados en lo residencial, con cuidados de tipo familiar.

## Marco regulatorio

Los hogares deben contar con habilitación municipal y cumplir requisitos edilicios, sanitarios y de personal. La fiscalización combina inspecciones del municipio (control urbano y bromatología) y de la provincia (Ministerio de Salud).

## Sobre los datos

El registro municipal lista los hogares con titular responsable, nombre comercial o de fantasía y dirección. No contiene datos sobre cantidad de plazas, residentes alojados o personal: la información sobre capacidad y ocupación es competencia provincial.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
