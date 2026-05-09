/**
 * Procesa el dataset "viajes-y-kilometros-recorridos-tup" (Transporte Urbano de Pasajeros).
 * - Lee 6 archivos anuales (2020-2025): mes (M/YYYY), km_totales, cantidad_viajes.
 * - KPIs: viajes totales, km totales, promedio mensual, año pico.
 * - Charts: line km/mes, line viajes/mes, area anual.
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

const REPORT_ID = 'obras-servicios/viajes-tup';
const CKAN_ID = 'viajes-y-kilometros-recorridos-tup';

const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function parseMes(s) {
  if (!s) return null;
  let m = String(s).match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) return { anio: Number(m[2]), mesIdx: Number(m[1]) - 1 };
  m = String(s).match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return { anio: Number(m[1]), mesIdx: Number(m[2]) - 1 };
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
      all.push({
        anio: parsed.anio || anioFile,
        mesIdx: parsed.mesIdx,
        mesLabel: MES_LABELS[parsed.mesIdx],
        km: parseSpanishNumber(r.km_totales) || 0,
        viajes: parseSpanishNumber(r.cantidad_viajes) || 0,
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const totalViajes = all.reduce((s, r) => s + r.viajes, 0);
  const totalKm = all.reduce((s, r) => s + r.km, 0);
  const promedioMensual = all.length > 0 ? totalViajes / all.length : 0;

  const porAnio = {};
  for (const r of all) {
    if (!porAnio[r.anio]) porAnio[r.anio] = { km: 0, viajes: 0 };
    porAnio[r.anio].km += r.km;
    porAnio[r.anio].viajes += r.viajes;
  }
  const yearsSorted = Object.keys(porAnio).map(Number).sort((a, b) => a - b);
  const yearPico = yearsSorted.reduce((max, y) => (porAnio[y].viajes > porAnio[max].viajes ? y : max), yearsSorted[0]);

  const kpis = [
    buildKPI({
      id: 'total-viajes',
      label: 'Viajes realizados',
      value: totalViajes,
      formatted: formatNumberAR(totalViajes),
      hint: `Acumulado ${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}`,
    }),
    buildKPI({
      id: 'total-km',
      label: 'Kilómetros recorridos',
      value: Math.round(totalKm),
      formatted: `${formatNumberAR(Math.round(totalKm))} km`,
      hint: 'Suma de kilómetros de todas las unidades del sistema.',
    }),
    buildKPI({
      id: 'promedio-mensual',
      label: 'Promedio mensual',
      value: Math.round(promedioMensual),
      formatted: formatNumberAR(Math.round(promedioMensual)),
      unit: 'viajes/mes',
    }),
    buildKPI({
      id: 'anio-pico',
      label: 'Año pico (viajes)',
      value: porAnio[yearPico]?.viajes || 0,
      formatted: String(yearPico),
      hint: `${formatNumberAR(porAnio[yearPico]?.viajes || 0)} viajes`,
    }),
  ];

  // ─── Charts ───

  const sorted = [...all].sort((a, b) => a.anio === b.anio ? a.mesIdx - b.mesIdx : a.anio - b.anio);

  // 1. Km mensual
  const kmData = sorted.map((r) => ({
    periodo: `${r.mesLabel} ${String(r.anio).slice(-2)}`,
    km: Math.round(r.km),
  }));

  // 2. Viajes mensual
  const viajesData = sorted.map((r) => ({
    periodo: `${r.mesLabel} ${String(r.anio).slice(-2)}`,
    viajes: r.viajes,
  }));

  // 3. Anual (area)
  const anioData = yearsSorted.map((y) => ({
    anio: String(y),
    Viajes: porAnio[y].viajes,
    Kilómetros: Math.round(porAnio[y].km),
  }));

  const charts = [
    {
      id: 'km-mensual',
      type: 'line',
      title: 'Kilómetros recorridos por mes',
      subtitle: 'Distancia total mensual de las unidades del sistema TUP.',
      data: kmData,
      config: { indexBy: 'periodo', keys: ['km'] },
    },
    {
      id: 'viajes-mensual',
      type: 'line',
      title: 'Viajes realizados por mes',
      subtitle: 'Cantidad de viajes-pasajero registrados mensualmente.',
      data: viajesData,
      config: { indexBy: 'periodo', keys: ['viajes'] },
    },
    {
      id: 'anual',
      type: 'area',
      title: 'Resumen anual',
      subtitle: 'Comparación de viajes y kilómetros por año.',
      data: anioData,
      config: { indexBy: 'anio', keys: ['Viajes', 'Kilómetros'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Transporte Urbano de Pasajeros (TUP)',
      category: 'obras-servicios',
      description:
        'Sistema de Transporte Urbano de Pasajeros: cantidad de viajes realizados y kilómetros recorridos por las unidades del servicio mes a mes desde 2020.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    totalViajes,
    totalKm,
    promedioMensual,
    yearPico,
    yearPicoViajes: porAnio[yearPico]?.viajes || 0,
    yearsRange: `${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}`,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ totalViajes, totalKm, promedioMensual, yearPico, yearPicoViajes, yearsRange }) {
  return `## Resumen

Entre **${yearsRange}**, el sistema de **Transporte Urbano de Pasajeros (TUP)** realizó **${formatNumberAR(totalViajes)} viajes**, recorriendo **${formatNumberAR(Math.round(totalKm))} km** en total. El promedio mensual fue de **${formatNumberAR(Math.round(promedioMensual))} viajes**. El año pico fue **${yearPico}** con **${formatNumberAR(yearPicoViajes)} viajes**.

## Sistema TUP

El TUP es la red de **transporte público urbano** de Venado Tuerto, operada por concesión municipal. Las unidades cubren los principales corredores de la ciudad conectando barrios periféricos con el centro y áreas de servicios (hospital, terminal, estaciones, polígonos industriales).

## Indicadores clave

- **Viajes realizados:** cantidad de pasajeros transportados (medidos por boletos cortados o registros del sistema SUBE local).
- **Kilómetros recorridos:** distancia total de las unidades, indicador de la oferta de servicio independientemente de la demanda.

La relación viajes/km da una idea de la **densidad de uso del sistema**: tramos más frecuentados muestran muchos viajes por km, tramos extensos pero menos demandados muestran muchos km con menos viajes.

## Estacionalidad

La demanda del transporte público suele caer fuertemente en **enero** (vacaciones) y en **fines de año** (cierre de actividades), y mantenerse estable durante el ciclo lectivo y laboral. Eventos puntuales (paros, días no laborables, carnavales) producen valles puntuales.

## Sobre los datos

El registro mensual contiene km totales y cantidad de viajes consolidados por la concesionaria del servicio y reportados al municipio. No discrimina por línea, recorrido específico ni horario.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
