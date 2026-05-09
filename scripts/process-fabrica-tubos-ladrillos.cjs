/**
 * Procesa el dataset "fabricacion-municipal-de-tubos-y-ladrillos-2020".
 * - Lee 6 archivos anuales (2020-2025): mes (YYYY-MM o M/YYYY), caños y bloques.
 * - KPIs: producción total caños, bloques, mes pico, año pico.
 * - Charts: line caños/mes, bar bloques/año, area total mensual.
 */

const {
  readCSV,
  parseSpanishNumber,
  extractYearFromPath,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'obras-servicios/fabrica-tubos-ladrillos';
const CKAN_ID = 'fabricacion-municipal-de-tubos-y-ladrillos-2020';

const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function parseMes(s) {
  if (!s) return null;
  // YYYY-MM o YYYY/MM
  let m = String(s).match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return { anio: Number(m[1]), mesIdx: Number(m[2]) - 1 };
  // M/YYYY o MM/YYYY
  m = String(s).match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) return { anio: Number(m[2]), mesIdx: Number(m[1]) - 1 };
  return null;
}

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const anioFile = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const parsed = parseMes(r.mes);
      if (!parsed) continue;
      // Detectar dinámicamente columnas que arrancan con 'caño' y las de bloques/ladrillos
      let canios = 0;
      let bloques = 0;
      for (const k of Object.keys(r)) {
        const lk = String(k).toLowerCase();
        if (lk.startsWith('caño') || lk.startsWith('cano') || lk.startsWith('cao') || lk.startsWith('caÃ±')) {
          canios += parseSpanishNumber(r[k]) || 0;
        } else if (lk.includes('block') || lk.includes('bloque') || lk.includes('ladrillo')) {
          bloques += parseSpanishNumber(r[k]) || 0;
        }
      }
      all.push({
        anio: parsed.anio || anioFile,
        mesIdx: parsed.mesIdx,
        mesLabel: MES_LABELS[parsed.mesIdx] || '?',
        canios,
        bloques,
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const totalCanios = all.reduce((s, r) => s + r.canios, 0);
  const totalBloques = all.reduce((s, r) => s + r.bloques, 0);

  const ordenadoCanios = [...all].sort((a, b) => b.canios - a.canios);
  const picoCanios = ordenadoCanios[0];

  const porAnio = {};
  for (const r of all) {
    if (!porAnio[r.anio]) porAnio[r.anio] = { canios: 0, bloques: 0 };
    porAnio[r.anio].canios += r.canios;
    porAnio[r.anio].bloques += r.bloques;
  }
  const yearsSorted = Object.keys(porAnio).map(Number).sort((a, b) => a - b);
  const yearPico = yearsSorted.reduce((max, y) => ((porAnio[y].canios + porAnio[y].bloques) > (porAnio[max].canios + porAnio[max].bloques) ? y : max), yearsSorted[0]);

  const kpis = [
    buildKPI({
      id: 'total-canios',
      label: 'Caños fabricados',
      value: totalCanios,
      formatted: formatNumberAR(totalCanios),
      hint: 'Producción total acumulada (medidas 600/800/1000/1200).',
    }),
    buildKPI({
      id: 'total-bloques',
      label: 'Bloques fabricados',
      value: totalBloques,
      formatted: formatNumberAR(totalBloques),
      hint: 'Bloques de hormigón producidos en la fábrica municipal.',
    }),
    buildKPI({
      id: 'mes-pico',
      label: 'Mes pico (caños)',
      value: picoCanios?.canios || 0,
      formatted: picoCanios ? `${picoCanios.mesLabel} ${picoCanios.anio}` : '—',
      hint: picoCanios ? `${formatNumberAR(picoCanios.canios)} caños producidos` : '',
    }),
    buildKPI({
      id: 'anio-pico',
      label: 'Año pico (producción total)',
      value: (porAnio[yearPico]?.canios || 0) + (porAnio[yearPico]?.bloques || 0),
      formatted: String(yearPico),
      hint: `${formatNumberAR(porAnio[yearPico]?.canios || 0)} caños · ${formatNumberAR(porAnio[yearPico]?.bloques || 0)} bloques`,
    }),
  ];

  // ─── Charts ───

  const sorted = [...all].sort((a, b) => a.anio === b.anio ? a.mesIdx - b.mesIdx : a.anio - b.anio);

  // 1. Caños por mes (todos los años en serie temporal)
  const caniosData = sorted.map((r) => ({
    periodo: `${r.mesLabel} ${String(r.anio).slice(-2)}`,
    caños: r.canios,
  }));

  // 2. Bloques por año (bar)
  const bloquesAnioData = yearsSorted.map((y) => ({
    anio: String(y),
    bloques: porAnio[y].bloques,
  }));

  // 3. Total mensual (area)
  const mensualData = sorted.map((r) => ({
    periodo: `${r.mesLabel} ${String(r.anio).slice(-2)}`,
    Caños: r.canios,
    Bloques: r.bloques,
  }));

  const charts = [
    {
      id: 'canios-mensual',
      type: 'line',
      title: 'Producción mensual de caños',
      subtitle: 'Caños fabricados mes a mes (todas las medidas combinadas).',
      data: caniosData,
      config: { indexBy: 'periodo', keys: ['caños'] },
    },
    {
      id: 'bloques-anio',
      type: 'bar',
      title: 'Producción anual de bloques',
      subtitle: 'Bloques de hormigón fabricados año por año.',
      data: bloquesAnioData,
      config: { indexBy: 'anio', keys: ['bloques'] },
    },
    {
      id: 'total-mensual',
      type: 'area',
      title: 'Producción total mensual',
      subtitle: 'Caños y bloques producidos mes a mes.',
      data: mensualData,
      config: { indexBy: 'periodo', keys: ['Caños', 'Bloques'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Fábrica Municipal de Tubos y Ladrillos',
      category: 'obras-servicios',
      description:
        'Producción de la fábrica municipal de tubos de hormigón y bloques: caños para desagües (medidas 600/800/1000/1200) y bloques para construcciones, utilizados en obras propias y vendidos a vecinos.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    totalCanios,
    totalBloques,
    picoCanios,
    yearPico,
    yearsRange: `${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}`,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ totalCanios, totalBloques, picoCanios, yearPico, yearsRange }) {
  return `## Resumen

Entre **${yearsRange}**, la **fábrica municipal de tubos y ladrillos** produjo **${formatNumberAR(totalCanios)} caños** de hormigón y **${formatNumberAR(totalBloques)} bloques**. ${picoCanios ? `El mes de mayor producción de caños fue **${picoCanios.mesLabel} ${picoCanios.anio}** con **${formatNumberAR(picoCanios.canios)} unidades**. ` : ''}El año pico de producción total fue **${yearPico}**.

## Productos

La fábrica produce **caños de hormigón** en distintas medidas (600 mm, 800 mm, 1000 mm y 1200 mm de diámetro), utilizados para desagües pluviales, alcantarillas y conexiones de servicios. También fabrica **bloques de hormigón** para construcción de paredes y muros.

## Lógica de la fábrica

La fábrica abastece dos demandas: las **obras propias del municipio** (pavimento, cordón cuneta, viviendas sociales) y la **venta a vecinos** a precios subsidiados. Esto último permite a familias de menores ingresos acceder a materiales de construcción que en el mercado privado serían más caros.

## Sobre los datos

Cada registro mensual contabiliza la cantidad de unidades producidas por tipo (caños 600, 800, 1000, 1200 y bloques). No incluye datos de costos, ingresos por ventas, ni de las obras o vecinos que reciben la producción.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
