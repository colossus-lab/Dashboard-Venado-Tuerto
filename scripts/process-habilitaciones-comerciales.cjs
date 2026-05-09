/**
 * Procesa el dataset "habilitaciones-comerciales".
 * - Lee 6 archivos anuales (2020-2025): cada uno con 12 filas (mes + cantidad).
 *   Estructura: columnas [<año>, "Mes"] — el header de la columna numérica es el año.
 * - KPIs: total histórico, promedio anual, año pico, último mes.
 * - Charts: serie por año (line), mensual último año (bar), acumulado (area).
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

const REPORT_ID = 'hacienda-economia/habilitaciones-comerciales';
const CKAN_ID = 'habilitaciones-comerciales';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  // { 2020: [12 valores], 2021: [...], ... }
  const porAnio = {};
  for (const res of ds.resources) {
    const anio = extractYearFromPath(res.local_path);
    if (!anio) continue;
    const rows = readCSV(localPath(res));
    const valores = Array(12).fill(0);
    for (const r of rows) {
      const mes = String(r.Mes || r.mes || '').toLowerCase().trim();
      const idx = MESES.indexOf(mes);
      if (idx < 0) continue;
      // El nombre de la columna numérica es el año (string)
      const valor = parseSpanishNumber(r[String(anio)]);
      if (Number.isFinite(valor)) valores[idx] = valor;
    }
    porAnio[anio] = valores;
  }

  const yearsSorted = Object.keys(porAnio).map(Number).sort((a, b) => a - b);
  const lastYear = yearsSorted[yearsSorted.length - 1];

  console.log(`    años: ${yearsSorted.join(', ')}`);

  // ─── KPIs ───
  const totalPorAnio = {};
  for (const y of yearsSorted) {
    totalPorAnio[y] = porAnio[y].reduce((a, b) => a + b, 0);
  }

  const totalHistorico = Object.values(totalPorAnio).reduce((a, b) => a + b, 0);
  const promedioAnual = yearsSorted.length > 0 ? totalHistorico / yearsSorted.length : 0;
  const yearPico = yearsSorted.reduce((max, y) => (totalPorAnio[y] > totalPorAnio[max] ? y : max), yearsSorted[0]);

  // Último mes con datos del último año
  const mesesUlt = porAnio[lastYear] || [];
  let ultimoMesIdx = -1;
  for (let i = mesesUlt.length - 1; i >= 0; i--) {
    if (mesesUlt[i] > 0) { ultimoMesIdx = i; break; }
  }
  const ultimoMesLabel = ultimoMesIdx >= 0 ? `${MESES_LABEL[ultimoMesIdx]} ${lastYear}` : '—';
  const ultimoMesValor = ultimoMesIdx >= 0 ? mesesUlt[ultimoMesIdx] : 0;

  const kpis = [
    buildKPI({
      id: 'total-historico',
      label: 'Habilitaciones totales',
      value: totalHistorico,
      formatted: formatNumberAR(totalHistorico),
      hint: `Acumulado ${yearsSorted[0]}–${lastYear}.`,
    }),
    buildKPI({
      id: 'promedio-anual',
      label: 'Promedio anual',
      value: Math.round(promedioAnual),
      formatted: formatNumberAR(Math.round(promedioAnual)),
      unit: 'habilitaciones/año',
    }),
    buildKPI({
      id: 'anio-pico',
      label: 'Año pico',
      value: totalPorAnio[yearPico] || 0,
      formatted: String(yearPico),
      hint: `${formatNumberAR(totalPorAnio[yearPico] || 0)} habilitaciones`,
    }),
    buildKPI({
      id: 'ultimo-mes',
      label: 'Último mes registrado',
      value: ultimoMesValor,
      formatted: ultimoMesLabel,
      hint: `${formatNumberAR(ultimoMesValor)} habilitaciones`,
    }),
  ];

  // ─── Charts ───

  // 1. Total por año (line)
  const anioData = yearsSorted.map((y) => ({
    anio: String(y),
    habilitaciones: totalPorAnio[y],
  }));

  // 2. Mensual último año (bar)
  const mensualData = MESES_LABEL.map((m, i) => ({
    mes: m,
    habilitaciones: mesesUlt[i] || 0,
  }));

  // 3. Mensual todos los años (line múltiple)
  const todosMensualData = MESES_LABEL.map((m, i) => {
    const obj = { mes: m };
    for (const y of yearsSorted) {
      obj[String(y)] = porAnio[y][i] || 0;
    }
    return obj;
  });

  const charts = [
    {
      id: 'total-por-anio',
      type: 'line',
      title: 'Habilitaciones comerciales por año',
      subtitle: `Total anual de habilitaciones otorgadas (${yearsSorted[0]}–${lastYear}).`,
      data: anioData,
      config: { indexBy: 'anio', keys: ['habilitaciones'] },
    },
    {
      id: 'mensual-todos-anios',
      type: 'line',
      title: 'Habilitaciones mes a mes (todos los años)',
      subtitle: 'Comparación interanual de actividad comercial mensual.',
      data: todosMensualData,
      config: { indexBy: 'mes', keys: yearsSorted.map(String) },
    },
    {
      id: `mensual-${lastYear}`,
      type: 'bar',
      title: `Habilitaciones mensuales ${lastYear}`,
      subtitle: 'Distribución mensual del último año disponible.',
      data: mensualData,
      config: { indexBy: 'mes', keys: ['habilitaciones'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Habilitaciones Comerciales',
      category: 'hacienda-economia',
      description:
        'Cantidad de habilitaciones comerciales otorgadas por el municipio mes a mes desde 2020. Indicador de la dinámica empresarial y emprendedora local.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    yearsRange: `${yearsSorted[0]}–${lastYear}`,
    totalHistorico,
    promedioAnual,
    yearPico,
    valorPico: totalPorAnio[yearPico] || 0,
    ultimoMesLabel,
    ultimoMesValor,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ yearsRange, totalHistorico, promedioAnual, yearPico, valorPico, ultimoMesLabel, ultimoMesValor }) {
  return `## Resumen

Entre **${yearsRange}**, el municipio otorgó **${formatNumberAR(totalHistorico)} habilitaciones comerciales**, con un promedio anual de **${formatNumberAR(Math.round(promedioAnual))} habilitaciones**. El año pico fue **${yearPico}**, con **${formatNumberAR(valorPico)} habilitaciones** otorgadas.

## Estacionalidad

Las habilitaciones suelen concentrarse en los primeros meses del año, asociadas al inicio de actividad de comercios estacionales y a regularizaciones de fin de ejercicio anterior. Los meses con menor actividad suelen ser julio y diciembre.

## Último período

El último mes registrado es **${ultimoMesLabel}** con **${formatNumberAR(ultimoMesValor)} habilitaciones**. Comparar este valor con el mismo mes de años anteriores ayuda a leer si el ritmo de altas comerciales se mantiene, acelera o desacelera.

## Sobre los datos

El dataset registra únicamente las habilitaciones **otorgadas** (altas), no las bajas ni las renovaciones. Una habilitación nueva implica un comercio que inicia actividad o cambia de razón social/domicilio.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
