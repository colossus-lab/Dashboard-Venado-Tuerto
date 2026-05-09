/**
 * Procesa el dataset "ingreso-de-planos-2020".
 * - Lee 6 archivos anuales (2020-2025): cada fila es un plano presentado.
 * - Estructura: presentacion_plano, ingreso (YYYY-MM-DD), inmueble, superficie_en_m2, usos.
 * - KPIs: total planos, m² total, usos distintos, año pico.
 * - Charts: area por año, horizontalBar uso, bar m² promedio por año.
 */

const {
  readCSV,
  parseSpanishNumber,
  extractYearFromPath,
  countBy,
  sumBy,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'obras-servicios/ingreso-planos';
const CKAN_ID = 'ingreso-de-planos-2020';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const anioFile = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const presentacion = String(r.presentacion_plano || '').trim();
      // El año del plano viene en presentacion_plano (formato YYYY-MM-N)
      const m = presentacion.match(/^(\d{4})/);
      const anio = m ? Number(m[1]) : anioFile;
      all.push({
        anio,
        m2: parseSpanishNumber(r.superficie_en_m2) || 0,
        uso: String(r.usos || '').trim(),
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const total = all.length;
  const m2Total = sumBy(all, (r) => r.m2);
  const usosDistintos = new Set(all.map((r) => r.uso).filter(Boolean)).size;

  const porAnio = countBy(all, (r) => r.anio);
  const yearsSorted = [...porAnio.keys()].filter(Boolean).sort((a, b) => a - b);
  const yearPico = yearsSorted.reduce((max, y) => (porAnio.get(y) > porAnio.get(max) ? y : max), yearsSorted[0]);

  const kpis = [
    buildKPI({
      id: 'total',
      label: 'Planos presentados',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'planos',
      hint: `Acumulado ${yearsSorted[0] || '—'}–${yearsSorted[yearsSorted.length - 1] || '—'}`,
    }),
    buildKPI({
      id: 'm2',
      label: 'Superficie total declarada',
      value: Math.round(m2Total),
      formatted: `${formatNumberAR(Math.round(m2Total))} m²`,
      hint: 'Suma de la superficie de todos los planos presentados.',
    }),
    buildKPI({
      id: 'usos',
      label: 'Usos distintos',
      value: usosDistintos,
      formatted: formatNumberAR(usosDistintos),
      hint: 'Vivienda, comercio, industrial, conforme a obra, etc.',
    }),
    buildKPI({
      id: 'anio-pico',
      label: 'Año pico',
      value: porAnio.get(yearPico) || 0,
      formatted: String(yearPico),
      hint: `${formatNumberAR(porAnio.get(yearPico) || 0)} planos presentados`,
    }),
  ];

  // ─── Charts ───

  // 1. Por año
  const anioData = yearsSorted.map((y) => ({ anio: String(y), planos: porAnio.get(y) || 0 }));

  // 2. Por uso (top 10)
  const usoCounts = countBy(
    all.filter((r) => r.uso),
    (r) => r.uso,
  );
  const usoData = [...usoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([u, c]) => ({
      uso: u.length > 28 ? u.slice(0, 26) + '…' : u,
      planos: c,
    }));

  // 3. Superficie promedio por año
  const m2PromedioData = yearsSorted.map((y) => {
    const items = all.filter((r) => r.anio === y);
    const sum = items.reduce((s, r) => s + r.m2, 0);
    const prom = items.length > 0 ? sum / items.length : 0;
    return { anio: String(y), m2: Math.round(prom) };
  });

  const charts = [
    {
      id: 'por-anio',
      type: 'area',
      title: 'Planos presentados por año',
      subtitle: 'Volumen anual de presentaciones.',
      data: anioData,
      config: { indexBy: 'anio', keys: ['planos'] },
    },
    {
      id: 'por-uso',
      type: 'horizontalBar',
      title: 'Planos por uso declarado (top 10)',
      subtitle: 'Vivienda, comercio, industria, conforme a obra y otros.',
      data: usoData,
      config: { indexBy: 'uso', keys: ['planos'] },
    },
    {
      id: 'm2-promedio',
      type: 'bar',
      title: 'Superficie promedio por plano (por año)',
      subtitle: 'Tamaño promedio de las construcciones presentadas (m²).',
      data: m2PromedioData,
      config: { indexBy: 'anio', keys: ['m2'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Ingreso de Planos',
      category: 'obras-servicios',
      description:
        'Planos de construcción presentados ante la municipalidad: nuevas viviendas, ampliaciones, locales comerciales y registros conforme a obra. Indicador de la actividad de la construcción privada.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    total,
    m2Total,
    usosDistintos,
    yearPico,
    yearPicoCount: porAnio.get(yearPico) || 0,
    yearsRange: yearsSorted.length > 0 ? `${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}` : '—',
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, m2Total, usosDistintos, yearPico, yearPicoCount, yearsRange }) {
  return `## Resumen

Entre **${yearsRange}**, se presentaron **${formatNumberAR(total)} planos** ante la municipalidad, sumando **${formatNumberAR(Math.round(m2Total))} m²** de superficie declarada. Los planos se clasifican en **${formatNumberAR(usosDistintos)} usos** distintos. El año pico fue **${yearPico}** con **${formatNumberAR(yearPicoCount)} presentaciones**.

## Tipos de plano

- **Vivienda:** plano de obra nueva o ampliación de una vivienda particular.
- **Conforme a obra:** registro de una construcción ya ejecutada (regularización).
- **Comercio / Industria:** locales comerciales, depósitos, naves industriales.
- **Otros:** edificios públicos, equipamiento educativo, salud.

## Por qué importa

El **volumen de planos** es uno de los principales indicadores adelantados de la **actividad de la construcción privada** en el municipio. Aumentos sostenidos preceden ciclos de crecimiento; caídas anticipan contracciones. La **superficie promedio** complementa el dato: superficies pequeñas suelen indicar viviendas familiares y ampliaciones; superficies grandes reflejan emprendimientos comerciales o multivivienda.

## Trámite

El propietario o el profesional matriculado (arquitecto/ingeniero) presenta el plano firmado, paga las tasas correspondientes y obtiene la aprobación municipal. Sin plano aprobado no puede iniciarse la obra (en el caso de obra nueva) ni registrarse el dominio (en conforme a obra).

## Sobre los datos

Cada registro identifica el plano por código de presentación (formato AAAA-MM-N), fecha de ingreso, identificación del inmueble (clave catastral o partida), superficie en m² y uso declarado. No incluye datos del titular ni del profesional firmante.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
