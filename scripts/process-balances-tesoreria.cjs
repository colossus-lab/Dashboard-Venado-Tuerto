/**
 * Procesa el dataset "balances-de-tesoreria".
 * - Lee 6 archivos anuales (2020-2025): balances mensuales por concepto.
 * - Estructura: Conceptos + 12 meses (ENERO..DICIEMBRE).
 *   Hay secciones (A., B., C., D., E.) seguidas de detalles y un TOTAL.
 *   Necesitamos: TOTAL de B (ingresos), TOTAL de C (egresos), D (saldo final).
 * - KPIs: ingresos/egresos último año, saldo final, variación interanual.
 * - Charts: ingresos vs egresos por año, saldo final por año, mensual último año.
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
  formatPercentAR,
  formatCurrencyARS,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'hacienda-economia/balances-tesoreria';
const CKAN_ID = 'balances-de-tesoreria';

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function sumMeses(row) {
  return MESES.reduce((s, m) => {
    const v = parseSpanishNumber(row[m]);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
}

function valuesByMonth(row) {
  return MESES.map((m) => {
    const v = parseSpanishNumber(row[m]);
    return Number.isFinite(v) ? v : 0;
  });
}

function processYear(rows) {
  // Detectar las filas TOTAL pertenecientes a cada sección
  let currentSection = null;
  const totals = {}; // { B: row, C: row, ... }
  let saldoFinal = null; // fila D

  for (const row of rows) {
    const c = String(row.Conceptos || '').trim();
    const headerMatch = c.match(/^([A-Z](?:\d)?)\.\s/);
    if (headerMatch) {
      currentSection = headerMatch[1];
      // Captura filas D (saldo final) que ya tienen valores
      if (currentSection === 'D' && MESES.some((m) => parseSpanishNumber(row[m]) > 0)) {
        saldoFinal = row;
      }
      continue;
    }
    if (c === 'TOTAL' && currentSection && !totals[currentSection]) {
      totals[currentSection] = row;
    }
  }

  return {
    ingresos: totals.B ? sumMeses(totals.B) : 0,
    egresos: totals.C ? sumMeses(totals.C) : 0,
    saldoFinal: saldoFinal ? Math.max(...valuesByMonth(saldoFinal).filter((v) => v > 0), 0) : 0,
    saldoMensual: saldoFinal ? valuesByMonth(saldoFinal) : Array(12).fill(0),
    ingresosMensuales: totals.B ? valuesByMonth(totals.B) : Array(12).fill(0),
    egresosMensuales: totals.C ? valuesByMonth(totals.C) : Array(12).fill(0),
  };
}

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  // Procesar cada año
  const porAnio = {};
  for (const res of ds.resources) {
    const anio = extractYearFromPath(res.local_path);
    if (!anio) continue;
    const rows = readCSV(localPath(res));
    porAnio[anio] = processYear(rows);
  }

  const yearsSorted = Object.keys(porAnio).map(Number).sort((a, b) => a - b);
  // Usar como "último año" el más reciente con datos reales (algunos archivos
  // del año en curso pueden no tener filas TOTAL todavía).
  const yearsConDatos = yearsSorted.filter((y) => (porAnio[y].ingresos || 0) > 0 || (porAnio[y].egresos || 0) > 0);
  const lastYear = yearsConDatos[yearsConDatos.length - 1] || yearsSorted[yearsSorted.length - 1];
  const prevYear = yearsConDatos[yearsConDatos.length - 2];

  console.log(`    años: ${yearsSorted.join(', ')}`);

  // ─── KPIs ───
  const ultimoAnio = porAnio[lastYear] || {};
  const anioAnterior = porAnio[prevYear] || {};

  const varIngresos =
    anioAnterior.ingresos > 0
      ? ((ultimoAnio.ingresos - anioAnterior.ingresos) / anioAnterior.ingresos) * 100
      : 0;

  const kpis = [
    buildKPI({
      id: 'ingresos-anio',
      label: `Ingresos ${lastYear}`,
      value: Math.round(ultimoAnio.ingresos || 0),
      formatted: formatCurrencyARS(ultimoAnio.ingresos || 0),
      hint: 'Recaudación tributaria, coparticipación e ingresos no tributarios.',
    }),
    buildKPI({
      id: 'egresos-anio',
      label: `Egresos ${lastYear}`,
      value: Math.round(ultimoAnio.egresos || 0),
      formatted: formatCurrencyARS(ultimoAnio.egresos || 0),
      hint: 'Sueldos, bienes, servicios y obras.',
    }),
    buildKPI({
      id: 'saldo-final',
      label: `Disponibilidades al cierre ${lastYear}`,
      value: Math.round(ultimoAnio.saldoFinal || 0),
      formatted: formatCurrencyARS(ultimoAnio.saldoFinal || 0),
      hint: 'Caja + bancos + plazos fijos + inversiones al final del ejercicio.',
    }),
    buildKPI({
      id: 'var-ingresos',
      label: `Variación interanual ingresos`,
      value: Number(varIngresos.toFixed(1)),
      formatted: formatPercentAR(varIngresos, 1),
      hint: prevYear ? `Comparado con ${prevYear}.` : 'Sin año anterior para comparar.',
      status: varIngresos >= 0 ? 'good' : 'warning',
    }),
  ];

  // ─── Charts ───

  // 1. Ingresos vs egresos por año
  const ingEgrAnioData = yearsSorted.map((y) => ({
    anio: String(y),
    Ingresos: Math.round(porAnio[y].ingresos || 0),
    Egresos: Math.round(porAnio[y].egresos || 0),
  }));

  // 2. Saldo final por año
  const saldoData = yearsSorted.map((y) => ({
    anio: String(y),
    saldo: Math.round(porAnio[y].saldoFinal || 0),
  }));

  // 3. Ingresos vs egresos mensuales del último año
  const mensualData = MESES_LABEL.map((m, i) => ({
    mes: m,
    Ingresos: Math.round((ultimoAnio.ingresosMensuales || [])[i] || 0),
    Egresos: Math.round((ultimoAnio.egresosMensuales || [])[i] || 0),
  }));

  const charts = [];

  if (ingEgrAnioData.some((d) => d.Ingresos > 0 || d.Egresos > 0)) {
    charts.push({
      id: 'ingresos-vs-egresos-anio',
      type: 'line',
      title: 'Ingresos y egresos anuales',
      subtitle: `Evolución del flujo de caja anual (${yearsSorted[0]}–${lastYear}).`,
      data: ingEgrAnioData,
      config: { indexBy: 'anio', keys: ['Ingresos', 'Egresos'] },
    });
  }

  if (saldoData.some((d) => d.saldo > 0)) {
    charts.push({
      id: 'saldo-anio',
      type: 'bar',
      title: 'Disponibilidades al cierre por año',
      subtitle: 'Saldo total de caja, bancos, plazos fijos e inversiones al 31 de diciembre.',
      data: saldoData,
      config: { indexBy: 'anio', keys: ['saldo'] },
    });
  }

  if (mensualData.some((d) => d.Ingresos > 0 || d.Egresos > 0)) {
    charts.push({
      id: 'mensual-ultimo-anio',
      type: 'area',
      title: `Flujo mensual ${lastYear}`,
      subtitle: 'Ingresos y egresos mes a mes durante el último año.',
      data: mensualData,
      config: { indexBy: 'mes', keys: ['Ingresos', 'Egresos'] },
    });
  }

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Balances de Tesorería',
      category: 'hacienda-economia',
      description:
        'Balances mensuales de tesorería del Municipio de Venado Tuerto: ingresos por concepto, egresos por destino, saldos disponibles y variaciones, año por año desde 2020.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    lastYear,
    prevYear,
    ingresos: ultimoAnio.ingresos || 0,
    egresos: ultimoAnio.egresos || 0,
    saldoFinal: ultimoAnio.saldoFinal || 0,
    varIngresos,
    yearsRange: `${yearsSorted[0]}–${lastYear}`,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ lastYear, prevYear, ingresos, egresos, saldoFinal, varIngresos, yearsRange }) {
  return `## Resumen

En **${lastYear}**, la Tesorería municipal de Venado Tuerto registró ingresos por **${formatCurrencyARS(ingresos)}** y egresos por **${formatCurrencyARS(egresos)}**, cerrando el ejercicio con disponibilidades de **${formatCurrencyARS(saldoFinal)}** entre caja, bancos, plazos fijos e inversiones.

## Variación interanual

${prevYear
  ? `Los ingresos del ejercicio variaron **${formatPercentAR(varIngresos, 1)}** respecto a ${prevYear}. Esta variación combina aumento real de la recaudación, ajuste por inflación de los valores nominales, y cambios en transferencias y coparticipaciones.`
  : `No hay año anterior disponible para comparar.`}

## Composición de ingresos

Los ingresos se desagregan en: **tributarios** (tasas municipales, derechos), **coparticipación** (nacional, provincial, ingresos brutos, inmobiliario, patentes), **fondo de asistencia financiera**, **ingresos no tributarios** (multas, servicios, alquileres) y **recursos de capital y financiamiento**.

## Composición de egresos

Los egresos se desagregan en: **operaciones corrientes** (sueldos, bienes y servicios), **erogaciones de capital** (obras, equipamiento), **transferencias** (subsidios, becas, aportes a organizaciones), **judiciales** y **extra-presupuestarios** (retenciones de terceros).

## Sobre los datos

La serie cubre **${yearsRange}** con desagregación mensual. Los montos están en pesos corrientes (sin ajustar por inflación). Las cifras resumen las filas "TOTAL" de cada sección de los balances oficiales publicados por la Secretaría de Hacienda municipal.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
