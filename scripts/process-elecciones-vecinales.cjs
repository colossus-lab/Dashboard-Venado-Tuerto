/**
 * Procesa el dataset "elecciones-vecinales".
 * - Lee 1 archivo: barrio, mesa, cantidad_votantes (13 filas).
 * - KPIs: total votantes, mesas, barrios, promedio votantes/mesa.
 * - Charts: votantes por barrio, votantes por mesa.
 * - Tabla: ranking de barrios.
 */

const {
  readCSV,
  parseSpanishNumber,
  groupBy,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'gobierno/elecciones-vecinales';
const CKAN_ID = 'elecciones-vecinales';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => ({
    barrio: String(r.barrio || '').trim(),
    mesa: String(r.mesa || '').trim(),
    votantes: parseSpanishNumber(r.cantidad_votantes) || 0,
  })).filter((r) => r.barrio);

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const totalVotantes = rows.reduce((s, r) => s + r.votantes, 0);
  const mesasTotales = rows.length;
  const barriosDistintos = new Set(rows.map((r) => r.barrio)).size;
  const promedio = mesasTotales > 0 ? totalVotantes / mesasTotales : 0;

  const kpis = [
    buildKPI({
      id: 'total-votantes',
      label: 'Votos emitidos',
      value: totalVotantes,
      formatted: formatNumberAR(totalVotantes),
      unit: 'votantes',
    }),
    buildKPI({
      id: 'mesas',
      label: 'Mesas habilitadas',
      value: mesasTotales,
      formatted: formatNumberAR(mesasTotales),
      hint: 'Total de mesas distribuidas en la ciudad.',
    }),
    buildKPI({
      id: 'barrios',
      label: 'Barrios con elecciones',
      value: barriosDistintos,
      formatted: formatNumberAR(barriosDistintos),
      hint: 'Vecinales con comicios registrados.',
    }),
    buildKPI({
      id: 'promedio-mesa',
      label: 'Promedio por mesa',
      value: Math.round(promedio),
      formatted: formatNumberAR(Math.round(promedio)),
      unit: 'votantes/mesa',
    }),
  ];

  // ─── Charts ───

  // 1. Votantes por barrio (suma)
  const porBarrio = groupBy(rows, (r) => r.barrio);
  const barrioData = [...porBarrio.entries()]
    .map(([b, items]) => ({
      barrio: b,
      votantes: items.reduce((s, r) => s + r.votantes, 0),
    }))
    .sort((a, b) => b.votantes - a.votantes);

  // 2. Votantes por mesa (cada mesa es {barrio, mesa, votantes})
  const mesaData = rows
    .map((r) => ({
      mesa: `${r.barrio} #${r.mesa}`,
      votantes: r.votantes,
    }))
    .sort((a, b) => b.votantes - a.votantes);

  const charts = [
    {
      id: 'votantes-por-barrio',
      type: 'horizontalBar',
      title: 'Votantes por barrio',
      subtitle: 'Suma de votos emitidos en todas las mesas del barrio.',
      data: barrioData,
      config: { indexBy: 'barrio', keys: ['votantes'] },
    },
    {
      id: 'votantes-por-mesa',
      type: 'horizontalBar',
      title: 'Votantes por mesa',
      subtitle: 'Cantidad de votos en cada mesa habilitada.',
      data: mesaData,
      config: { indexBy: 'mesa', keys: ['votantes'] },
    },
  ];

  // ─── Tabla: ranking ───
  const tableRows = barrioData.map((b, i) => [
    String(i + 1),
    b.barrio,
    formatNumberAR(b.votantes),
    formatNumberAR(porBarrio.get(b.barrio).length),
  ]);

  const tables = [
    {
      id: 'ranking-barrios',
      title: 'Ranking de barrios por participación',
      columns: ['#', 'Barrio', 'Votantes', 'Mesas'],
      rows: tableRows,
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Elecciones Vecinales',
      category: 'gobierno',
      description:
        'Resultados de participación en las elecciones vecinales de Venado Tuerto: cantidad de votantes por mesa y por barrio, distribución territorial de la concurrencia electoral.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ totalVotantes, mesasTotales, barriosDistintos, promedio, top: barrioData[0] });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function renderMarkdown({ totalVotantes, mesasTotales, barriosDistintos, promedio, top }) {
  return `## Resumen

Las elecciones vecinales registraron **${formatNumberAR(totalVotantes)} votos emitidos** en **${formatNumberAR(mesasTotales)} mesas** distribuidas en **${formatNumberAR(barriosDistintos)} barrios** de la ciudad. El promedio fue de **${formatNumberAR(Math.round(promedio))} votantes por mesa**.

## Distribución territorial

${top ? `El barrio con mayor participación fue **${top.barrio}** con **${formatNumberAR(top.votantes)} votantes**. ` : ''}Los volúmenes por barrio reflejan tanto el tamaño poblacional como el grado de organización vecinal: barrios con vecinales activas suelen registrar mayor concurrencia.

## Marco institucional

Las elecciones vecinales se realizan periódicamente en cada comisión vecinal para renovar autoridades. Son convocadas por la propia comisión y supervisadas por el municipio, que provee materiales y asesoramiento. La participación es voluntaria y abierta a residentes del barrio.

## Sobre los datos

El registro contiene, por cada mesa habilitada, el barrio, el número de mesa y la cantidad de votantes. No incluye desagregación por candidato ni resultados nominales: refleja únicamente el nivel de concurrencia.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
