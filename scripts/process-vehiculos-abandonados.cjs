/**
 * Procesa el dataset "vehiculos-abandonados".
 * - Lee 5 archivos anuales (2021-2025): mes en formato "M/YYYY", retiro/funcionamiento/corralon.
 *   El archivo 2021 tiene una columna "retiro" extra que el resto no tiene.
 * - KPIs: total histórico, retiros/funcionamiento/corralón, año pico.
 * - Charts: serie por año, comparación interanual mensual.
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

const REPORT_ID = 'seguridad-convivencia/vehiculos-abandonados';
const CKAN_ID = 'vehiculos-abandonados';

const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const anio = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const mesRaw = String(r.mes || '').trim();
      const m = mesRaw.match(/^(\d{1,2})[\/\-]/);
      if (!m) continue;
      const mesIdx = Number(m[1]) - 1;
      if (mesIdx < 0 || mesIdx > 11) continue;
      all.push({
        anio,
        mesIdx,
        retiro: parseSpanishNumber(r.retiro) || 0,
        funcionamiento: parseSpanishNumber(r.funcionamiento) || 0,
        corralon: parseSpanishNumber(r.corralon) || 0,
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const totalRetiro = all.reduce((s, r) => s + r.retiro, 0);
  const totalFuncionamiento = all.reduce((s, r) => s + r.funcionamiento, 0);
  const totalCorralon = all.reduce((s, r) => s + r.corralon, 0);
  const total = totalRetiro + totalFuncionamiento + totalCorralon;

  // Por año
  const porAnio = {};
  for (const r of all) {
    if (!porAnio[r.anio]) porAnio[r.anio] = 0;
    porAnio[r.anio] += r.retiro + r.funcionamiento + r.corralon;
  }
  const yearsSorted = Object.keys(porAnio).map(Number).sort((a, b) => a - b);
  const yearPico = yearsSorted.reduce((max, y) => (porAnio[y] > porAnio[max] ? y : max), yearsSorted[0]);

  const kpis = [
    buildKPI({
      id: 'total',
      label: 'Vehículos relevados',
      value: total,
      formatted: formatNumberAR(total),
      hint: `Total acumulado ${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}.`,
    }),
    buildKPI({
      id: 'funcionamiento',
      label: 'Devueltos a funcionamiento',
      value: totalFuncionamiento,
      formatted: formatNumberAR(totalFuncionamiento),
      hint: 'Vehículos que volvieron a circular tras la intervención.',
      status: 'good',
    }),
    buildKPI({
      id: 'corralon',
      label: 'Movilizados al corralón',
      value: totalCorralon,
      formatted: formatNumberAR(totalCorralon),
      hint: 'Vehículos retirados de la vía pública.',
    }),
    buildKPI({
      id: 'anio-pico',
      label: 'Año con más casos',
      value: porAnio[yearPico] || 0,
      formatted: String(yearPico),
      hint: `${formatNumberAR(porAnio[yearPico] || 0)} vehículos relevados`,
    }),
  ];

  // ─── Charts ───

  // 1. Por año (serie agrupada por estado)
  const anioData = yearsSorted.map((y) => {
    const items = all.filter((r) => r.anio === y);
    return {
      anio: String(y),
      Funcionamiento: items.reduce((s, r) => s + r.funcionamiento, 0),
      Corralón: items.reduce((s, r) => s + r.corralon, 0),
      ...(items.some((r) => r.retiro > 0) ? { Retiro: items.reduce((s, r) => s + r.retiro, 0) } : {}),
    };
  });

  const anioKeys = Object.keys(anioData[0] || {}).filter((k) => k !== 'anio');

  // 2. Mensual último año
  const lastYear = yearsSorted[yearsSorted.length - 1];
  const ultimoAnio = all.filter((r) => r.anio === lastYear);
  const mensualData = MES_LABELS.map((m, i) => {
    const items = ultimoAnio.filter((r) => r.mesIdx === i);
    return {
      mes: m,
      Funcionamiento: items.reduce((s, r) => s + r.funcionamiento, 0),
      Corralón: items.reduce((s, r) => s + r.corralon, 0),
    };
  });

  const charts = [
    {
      id: 'por-anio',
      type: 'bar',
      title: 'Vehículos abandonados relevados por año',
      subtitle: 'Devueltos a funcionamiento, movilizados a corralón y retiros directos.',
      data: anioData,
      config: { indexBy: 'anio', keys: anioKeys },
    },
    {
      id: `mensual-${lastYear}`,
      type: 'line',
      title: `Distribución mensual ${lastYear}`,
      subtitle: 'Casos mes a mes en el último año disponible.',
      data: mensualData,
      config: { indexBy: 'mes', keys: ['Funcionamiento', 'Corralón'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Vehículos Abandonados',
      category: 'seguridad-convivencia',
      description:
        'Vehículos abandonados en la vía pública relevados por el municipio: cantidad mensual, devoluciones a funcionamiento, movilizaciones a corralón y retiros voluntarios. Indicador de gestión del espacio público y limpieza urbana.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    total,
    totalFuncionamiento,
    totalCorralon,
    totalRetiro,
    yearsRange: `${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}`,
    yearPico,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, totalFuncionamiento, totalCorralon, totalRetiro, yearsRange, yearPico }) {
  return `## Resumen

Entre **${yearsRange}**, el municipio relevó **${formatNumberAR(total)} vehículos** abandonados o estacionados en la vía pública en infracción. De ellos, **${formatNumberAR(totalFuncionamiento)}** fueron devueltos a funcionamiento por el propio dueño tras la intervención, y **${formatNumberAR(totalCorralon)}** debieron ser movilizados al corralón municipal. ${totalRetiro > 0 ? `Adicionalmente, **${formatNumberAR(totalRetiro)}** fueron retirados directamente.` : ''}

## Año pico

El año con mayor cantidad de casos fue **${yearPico}**, donde típicamente coinciden campañas de relevamiento sostenidas y un mayor flujo de denuncias vecinales por estacionamientos prolongados.

## Lógica de la intervención

El procedimiento típico consiste en: (1) detección por inspectores o denuncia vecinal; (2) intimación al propietario para retirar o regularizar el vehículo; (3) si en el plazo no se resuelve, movilización al corralón municipal con costo a cargo del titular. La mayoría de los casos se resuelven en la etapa de intimación, lo que explica por qué la mayoría figura como "devuelto a funcionamiento".

## Sobre los datos

El dataset registra mes a mes la cantidad de vehículos en cada estado de cierre del expediente (funcionamiento, corralón, retiro). El criterio de clasificación es el estado al final del procedimiento, no el motivo del relevamiento inicial.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
