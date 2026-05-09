/**
 * Procesa el dataset "establecimientos-comerciales-habilitados".
 * - Lee 1 archivo: 2365 establecimientos con barrio, rubros, vencimiento, etc.
 * - KPIs: total establecimientos, barrios, rubros únicos, top barrio.
 * - Charts: top barrios, top rubros (ambos horizontalBar).
 * - Tabla: top 25 barrios.
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

const REPORT_ID = 'hacienda-economia/establecimientos-comerciales';
const CKAN_ID = 'establecimientos-comerciales-habilitados';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => ({
    nombre: String(r.nombre || '').trim(),
    barrio: String(r.barrio || '').trim(),
    vencimiento: String(r.vencimiento || '').trim(),
    rubros: String(r.rubros || '').trim(),
  })).filter((r) => r.nombre);

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const total = rows.length;
  const barrioCounts = countBy(
    rows.filter((r) => r.barrio),
    (r) => r.barrio,
  );

  // Rubros pueden ser múltiples por establecimiento (separados por coma)
  const rubrosFlat = [];
  for (const r of rows) {
    if (!r.rubros) continue;
    for (const rub of r.rubros.split(',').map((s) => s.trim()).filter(Boolean)) {
      rubrosFlat.push(rub);
    }
  }
  const rubroCounts = countBy(rubrosFlat, (r) => r);

  const barriosDistintos = barrioCounts.size;
  const rubrosDistintos = rubroCounts.size;
  const topBarrioEntry = [...barrioCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Vigencia: contar establecimientos cuya fecha de vencimiento ya pasó
  const hoy = new Date();
  const vencidos = rows.filter((r) => {
    if (!r.vencimiento) return false;
    const m = r.vencimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return fecha < hoy;
  }).length;
  const pctVigentes = total > 0 ? ((total - vencidos) / total) * 100 : 0;

  const kpis = [
    buildKPI({
      id: 'total',
      label: 'Establecimientos habilitados',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'comercios',
    }),
    buildKPI({
      id: 'barrios',
      label: 'Barrios con actividad',
      value: barriosDistintos,
      formatted: formatNumberAR(barriosDistintos),
      hint: 'Distribución territorial del comercio.',
    }),
    buildKPI({
      id: 'rubros',
      label: 'Rubros distintos',
      value: rubrosDistintos,
      formatted: formatNumberAR(rubrosDistintos),
      hint: 'Diversidad de actividades comerciales.',
    }),
    buildKPI({
      id: 'vigentes',
      label: 'Habilitaciones vigentes',
      value: pctVigentes,
      formatted: formatPercentAR(pctVigentes, 1),
      hint: `${formatNumberAR(total - vencidos)} de ${formatNumberAR(total)} con vencimiento posterior a hoy.`,
      status: pctVigentes >= 80 ? 'good' : 'warning',
    }),
  ];

  // ─── Charts ───

  const topBarrios = [...barrioCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([b, c]) => ({
      barrio: b.length > 22 ? b.slice(0, 20) + '…' : b,
      establecimientos: c,
    }));

  const topRubros = [...rubroCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([r, c]) => ({
      rubro: r.length > 38 ? r.slice(0, 36) + '…' : r,
      establecimientos: c,
    }));

  const charts = [
    {
      id: 'top-barrios',
      type: 'horizontalBar',
      title: 'Establecimientos por barrio (top 15)',
      subtitle: 'Distribución territorial: barrios con mayor concentración comercial.',
      data: topBarrios,
      config: { indexBy: 'barrio', keys: ['establecimientos'] },
    },
    {
      id: 'top-rubros',
      type: 'horizontalBar',
      title: 'Rubros más frecuentes (top 15)',
      subtitle: 'Actividades comerciales con más habilitaciones registradas.',
      data: topRubros,
      config: { indexBy: 'rubro', keys: ['establecimientos'] },
    },
  ];

  // ─── Tabla: top 25 barrios ───
  const tableRows = [...barrioCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([b, c], i) => [
      String(i + 1),
      b,
      formatNumberAR(c),
      formatPercentAR((c / total) * 100, 1),
    ]);

  const tables = [
    {
      id: 'ranking-barrios',
      title: 'Top 25 barrios por cantidad de establecimientos',
      columns: ['#', 'Barrio', 'Establecimientos', 'Porcentaje'],
      rows: tableRows,
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Establecimientos Comerciales Habilitados',
      category: 'hacienda-economia',
      description:
        'Padrón de establecimientos comerciales con habilitación municipal vigente o histórica: titular, nombre comercial, ubicación, rubros y período de vigencia.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    total,
    barriosDistintos,
    rubrosDistintos,
    pctVigentes,
    topBarrio: topBarrioEntry ? topBarrioEntry[0] : '—',
    topBarrioCount: topBarrioEntry ? topBarrioEntry[1] : 0,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function renderMarkdown({ total, barriosDistintos, rubrosDistintos, pctVigentes, topBarrio, topBarrioCount }) {
  return `## Resumen

El padrón municipal registra **${formatNumberAR(total)} establecimientos comerciales** con habilitación, distribuidos en **${formatNumberAR(barriosDistintos)} barrios** y agrupados en **${formatNumberAR(rubrosDistintos)} rubros** distintos. Aproximadamente **${formatPercentAR(pctVigentes, 1)}** de las habilitaciones tiene vencimiento posterior a la fecha actual.

## Distribución territorial

El barrio con mayor concentración comercial es **${topBarrio}**, con **${formatNumberAR(topBarrioCount)} establecimientos** registrados. La distribución refleja tanto la densidad poblacional como los corredores comerciales tradicionales (avenidas principales, zonas céntricas).

## Diversidad de rubros

Los rubros más frecuentes corresponden a comercios minoristas (kioscos, despensas, autoservicios), gastronómicos (bares, restaurantes), y servicios profesionales. Un mismo establecimiento puede registrar varios rubros simultáneamente cuando combina actividades.

## Sobre los datos

Cada registro contiene el nombre del titular, nombre de fantasía del comercio, CUIT, dirección (calle, altura, barrio), período de vigencia (otorgada y vencimiento) y rubros declarados. Las habilitaciones se emiten por períodos típicos de 4 años y deben renovarse al vencer.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
