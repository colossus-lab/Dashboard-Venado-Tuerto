/**
 * Procesa el dataset "obras-de-pavimento-cordon-cuneta-y-otros-2020".
 * - Lee 6 archivos anuales (2020-2025): cada fila es una obra (año, tipo_obra, dirección, altura, barrio).
 * - KPIs: total obras, tipos distintos, barrios alcanzados, año pico.
 * - Charts: area por año, pie por tipo, horizontalBar por barrio.
 */

const {
  readCSV,
  extractYearFromPath,
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

const REPORT_ID = 'obras-servicios/obras-pavimento';
const CKAN_ID = 'obras-de-pavimento-cordon-cuneta-y-otros-2020';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const anioFile = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const anio = parseInt(String(r['año'] || r.anio || anioFile), 10) || anioFile;
      all.push({
        anio,
        tipo: String(r.tipo_obra || '').trim(),
        direccion: String(r['dirección'] || r.direccion || '').trim(),
        barrio: String(r.barrio || '').trim(),
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const total = all.length;
  const tiposDistintos = new Set(all.map((r) => r.tipo).filter(Boolean)).size;
  const barriosDistintos = new Set(all.map((r) => r.barrio).filter(Boolean)).size;

  // Año pico
  const porAnio = countBy(all, (r) => r.anio);
  const yearsSorted = [...porAnio.keys()].filter(Boolean).sort((a, b) => a - b);
  const yearPico = yearsSorted.reduce((max, y) => (porAnio.get(y) > porAnio.get(max) ? y : max), yearsSorted[0]);

  const kpis = [
    buildKPI({
      id: 'total-obras',
      label: 'Obras ejecutadas',
      value: total,
      formatted: formatNumberAR(total),
      hint: `Acumulado ${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}`,
    }),
    buildKPI({
      id: 'tipos',
      label: 'Tipos de obra',
      value: tiposDistintos,
      formatted: formatNumberAR(tiposDistintos),
      hint: 'Pavimento, cordón cuneta, repavimentación, etc.',
    }),
    buildKPI({
      id: 'barrios',
      label: 'Barrios beneficiados',
      value: barriosDistintos,
      formatted: formatNumberAR(barriosDistintos),
      hint: 'Distribución territorial de las obras viales.',
    }),
    buildKPI({
      id: 'anio-pico',
      label: 'Año pico',
      value: porAnio.get(yearPico) || 0,
      formatted: String(yearPico),
      hint: `${formatNumberAR(porAnio.get(yearPico) || 0)} obras ejecutadas`,
    }),
  ];

  // ─── Charts ───

  // 1. Por año
  const anioData = yearsSorted.map((y) => ({ anio: String(y), obras: porAnio.get(y) || 0 }));

  // 2. Por tipo (pie)
  const tipoCounts = countBy(
    all.filter((r) => r.tipo),
    (r) => r.tipo,
  );
  const tipoData = [...tipoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => ({ id: t, label: t, value: c }));

  // 3. Top barrios (horizontalBar)
  const barrioCounts = countBy(
    all.filter((r) => r.barrio),
    (r) => r.barrio,
  );
  const barrioData = [...barrioCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([b, c]) => ({
      barrio: b.length > 22 ? b.slice(0, 20) + '…' : b,
      obras: c,
    }));

  const charts = [
    {
      id: 'por-anio',
      type: 'area',
      title: 'Obras de pavimento y cordón cuneta por año',
      subtitle: 'Cantidad de intervenciones viales ejecutadas anualmente.',
      data: anioData,
      config: { indexBy: 'anio', keys: ['obras'] },
    },
    {
      id: 'por-tipo',
      type: 'pie',
      title: 'Distribución por tipo de obra',
      subtitle: 'Pavimento nuevo, cordón cuneta, repavimentación y otros.',
      data: tipoData,
      config: {},
    },
    {
      id: 'top-barrios',
      type: 'horizontalBar',
      title: 'Barrios con más obras (top 15)',
      subtitle: 'Distribución territorial: barrios con mayor cantidad de intervenciones.',
      data: barrioData,
      config: { indexBy: 'barrio', keys: ['obras'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Obras de Pavimento y Cordón Cuneta',
      category: 'obras-servicios',
      description:
        'Obras viales ejecutadas por el municipio: pavimento nuevo, cordón cuneta, repavimentación y otras intervenciones, con detalle de tipo, ubicación y año de ejecución.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ total, tiposDistintos, barriosDistintos, yearPico, yearsRange: `${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}` });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, tiposDistintos, barriosDistintos, yearPico, yearsRange }) {
  return `## Resumen

Entre **${yearsRange}**, el municipio ejecutó **${formatNumberAR(total)} obras** viales (pavimento, cordón cuneta y otras intervenciones), distribuidas en **${formatNumberAR(barriosDistintos)} barrios** y agrupadas en **${formatNumberAR(tiposDistintos)} tipos** distintos. El año pico fue **${yearPico}**.

## Tipos de obra

- **Pavimento:** apertura de calles nuevas o reposición integral del paquete asfáltico, generalmente en zonas en expansión o de tránsito intenso.
- **Cordón cuneta:** delimitación de calzada con cordón de hormigón y desagüe lineal, paso previo o complementario al pavimento.
- **Repavimentación / bacheos:** mantenimiento del paquete existente.
- **Otras:** sendas peatonales, badenes, alcantarillas, accesos.

## Distribución territorial

Las obras se distribuyen en función de un plan plurianual que combina criterios técnicos (tránsito, drenaje, conectividad), demanda vecinal (a través de comisiones vecinales y presupuesto participativo) y necesidades estructurales (zonas inundables, calles de tierra en barrios consolidados).

## Sobre los datos

Cada registro identifica una obra puntual: año de ejecución, tipo, dirección con altura y barrio. No incluye datos de costos, longitud (metros lineales o m²) ni empresa contratista. La unidad de análisis es la "obra" como evento, lo que puede subestimar el volumen real cuando una sola intervención abarca varias cuadras.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
