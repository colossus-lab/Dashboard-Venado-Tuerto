/**
 * Procesa el dataset "documentacion-emitida-por-el-centro-de-documentacion-rapida-2024".
 * - Lee 2 archivos: cdr-2024.csv + cdr-2025.csv (12 filas/año, una por mes).
 * - Calcula KPIs (total trámites, % DNI vs pasaporte, mes pico, promedio).
 * - Charts: trámites por mes (2 series), tipo de trámite, total mensual.
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
  formatPercentAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'gobierno/documentacion-cdr';
const CKAN_ID = 'documentacion-emitida-por-el-centro-de-documentacion-rapida-2024';

const MES_ORDER = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const COLS_DNI = ['actualizaciones', 'nuevo_ejemplar', 'nuevo_ejemplar_sin_cargo', 'dni_0_años', 'actualizacion_sin_cargo'];
const COL_PASAPORTE = 'pasaporte';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  // Cargar todos los archivos
  const all = [];
  for (const res of ds.resources) {
    const anio = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const mes = String(r.mes || '').toLowerCase().trim();
      const mesIdx = MES_ORDER.indexOf(mes);
      if (mesIdx < 0) continue;

      const dni = COLS_DNI.reduce((sum, k) => {
        const v = parseSpanishNumber(r[k]);
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0);
      const pasaporte = parseSpanishNumber(r[COL_PASAPORTE]) || 0;

      all.push({
        anio,
        mesIdx,
        mesNombre: MES_SHORT[mesIdx],
        dni,
        pasaporte,
        total: dni + pasaporte,
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const totalGeneral = all.reduce((s, r) => s + r.total, 0);
  const totalDni = all.reduce((s, r) => s + r.dni, 0);
  const totalPasaporte = all.reduce((s, r) => s + r.pasaporte, 0);
  const pctDni = totalGeneral > 0 ? (totalDni / totalGeneral) * 100 : 0;

  const ordenados = [...all].sort((a, b) => b.total - a.total);
  const pico = ordenados[0];
  const picoLabel = pico ? `${pico.mesNombre} ${pico.anio}` : '—';
  const promedio = all.length > 0 ? totalGeneral / all.length : 0;

  const kpis = [
    buildKPI({
      id: 'total-tramites',
      label: 'Trámites emitidos',
      value: totalGeneral,
      formatted: formatNumberAR(totalGeneral),
      hint: 'DNI (todos los tipos) + pasaportes',
    }),
    buildKPI({
      id: 'pct-dni',
      label: 'Trámites de DNI',
      value: pctDni,
      formatted: formatPercentAR(pctDni, 1),
      hint: `${formatNumberAR(totalDni)} de ${formatNumberAR(totalGeneral)}`,
    }),
    buildKPI({
      id: 'mes-pico',
      label: 'Mes pico',
      value: pico?.total || 0,
      formatted: picoLabel,
      hint: pico ? `${formatNumberAR(pico.total)} trámites` : '—',
    }),
    buildKPI({
      id: 'promedio',
      label: 'Promedio mensual',
      value: Math.round(promedio),
      formatted: formatNumberAR(Math.round(promedio)),
      unit: 'trámites/mes',
    }),
  ];

  // ─── Charts ───

  // 1. Trámites por mes (1 serie por año)
  const yearsSorted = [...new Set(all.map((r) => r.anio))].filter(Boolean).sort();
  // Datos: una fila por mes, con una columna por año
  const tramitesData = MES_SHORT.map((m, i) => {
    const obj = { mes: m };
    for (const y of yearsSorted) {
      const row = all.find((r) => r.mesIdx === i && r.anio === y);
      obj[String(y)] = row ? row.total : 0;
    }
    return obj;
  });

  // 2. DNI vs Pasaporte (bar)
  const tipoData = MES_SHORT.map((m, i) => {
    const dniSum = all.filter((r) => r.mesIdx === i).reduce((s, r) => s + r.dni, 0);
    const pasSum = all.filter((r) => r.mesIdx === i).reduce((s, r) => s + r.pasaporte, 0);
    return { mes: m, DNI: dniSum, Pasaporte: pasSum };
  });

  const charts = [
    {
      id: 'tramites-por-mes',
      type: 'line',
      title: 'Trámites emitidos por mes',
      subtitle: 'Total mensual de trámites (DNI + pasaporte) por año.',
      data: tramitesData,
      config: { indexBy: 'mes', keys: yearsSorted.map((y) => String(y)) },
    },
    {
      id: 'tipo-tramite',
      type: 'bar',
      title: 'Trámites por tipo (todos los meses)',
      subtitle: 'Distribución entre DNI y pasaporte, agregado por mes.',
      data: tipoData,
      config: { indexBy: 'mes', keys: ['DNI', 'Pasaporte'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Centro de Documentación Rápida (CDR)',
      category: 'gobierno',
      description:
        'Trámites emitidos en el Centro de Documentación Rápida del municipio: actualizaciones de DNI, nuevos ejemplares, pasaportes y trámites sin cargo, desagregados por mes y año.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ totalGeneral, pctDni, picoLabel, picoTotal: pico?.total || 0, promedio, yearsSorted });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ totalGeneral, pctDni, picoLabel, picoTotal, promedio, yearsSorted }) {
  const periodo = yearsSorted.length > 1 ? `${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}` : `${yearsSorted[0] || ''}`;
  return `## Resumen

El **Centro de Documentación Rápida (CDR)** del municipio emitió **${formatNumberAR(totalGeneral)} trámites** en el período ${periodo}, con un promedio mensual de **${formatNumberAR(Math.round(promedio))} trámites**.

## Distribución entre DNI y pasaporte

**${formatPercentAR(pctDni, 1)}** del volumen corresponde a trámites de **DNI** (actualizaciones, nuevos ejemplares y trámites sin cargo). El resto son **pasaportes**, que suelen tener picos asociados a temporadas de viajes y vacaciones.

## Mes pico

El mes de mayor demanda fue **${picoLabel}**, con **${formatNumberAR(picoTotal)} trámites** emitidos. Los meses pico suelen coincidir con campañas, planes de regularización o anticipo de vacaciones.

## Sobre los datos

El CDR es la oficina municipal que tramita DNI y pasaporte por delegación del Registro Civil de la provincia y del Ministerio del Interior. Las categorías incluyen actualizaciones (renovaciones obligatorias a los 5/8/14 años), nuevos ejemplares (extravío, robo o cambio de datos), pasaportes y los trámites "sin cargo" para sectores específicos (DNI 0 años, beneficiarios de programas sociales).
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
