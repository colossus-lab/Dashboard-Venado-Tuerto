/**
 * Procesa el dataset "carnets-de-manipulacion-de-alimentos-2025".
 * - Lee 1 archivo: 12 filas (mes en formato YYYY-MM, carnets emitidos).
 * - KPIs: total 2025, mes pico, promedio mensual, último mes.
 * - Charts: line por mes, area acumulado.
 */

const {
  readCSV,
  parseSpanishNumber,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'salud-desarrollo-humano/carnets-manipulacion-alimentos';
const CKAN_ID = 'carnets-de-manipulacion-de-alimentos-2025';

const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => {
    const mesRaw = String(r.mes || '').trim();
    const m = mesRaw.match(/^(\d{4})-(\d{1,2})$/);
    if (!m) return null;
    return {
      anio: Number(m[1]),
      mesIdx: Number(m[2]) - 1,
      mesLabel: MES_LABELS[Number(m[2]) - 1] || mesRaw,
      carnets: parseSpanishNumber(r.carnets) || 0,
    };
  }).filter(Boolean);

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const total = rows.reduce((s, r) => s + r.carnets, 0);
  const ordenado = [...rows].sort((a, b) => b.carnets - a.carnets);
  const pico = ordenado[0];
  const ultimoConDatos = [...rows].sort((a, b) => a.anio === b.anio ? a.mesIdx - b.mesIdx : a.anio - b.anio).filter((r) => r.carnets > 0).pop();
  const promedio = rows.length > 0 ? total / rows.length : 0;

  const kpis = [
    buildKPI({
      id: 'total',
      label: 'Carnets emitidos',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'carnets',
    }),
    buildKPI({
      id: 'mes-pico',
      label: 'Mes pico',
      value: pico?.carnets || 0,
      formatted: pico ? `${pico.mesLabel} ${pico.anio}` : '—',
      hint: pico ? `${formatNumberAR(pico.carnets)} carnets` : '',
    }),
    buildKPI({
      id: 'promedio',
      label: 'Promedio mensual',
      value: Math.round(promedio),
      formatted: formatNumberAR(Math.round(promedio)),
      unit: 'carnets/mes',
    }),
    buildKPI({
      id: 'ultimo-mes',
      label: 'Último mes registrado',
      value: ultimoConDatos?.carnets || 0,
      formatted: ultimoConDatos ? `${ultimoConDatos.mesLabel} ${ultimoConDatos.anio}` : '—',
      hint: ultimoConDatos ? `${formatNumberAR(ultimoConDatos.carnets)} carnets emitidos` : '',
    }),
  ];

  // ─── Charts ───

  const sorted = [...rows].sort((a, b) => a.anio === b.anio ? a.mesIdx - b.mesIdx : a.anio - b.anio);

  // 1. Mensual
  const mensualData = sorted.map((r) => ({
    mes: `${r.mesLabel} ${String(r.anio).slice(-2)}`,
    carnets: r.carnets,
  }));

  // 2. Acumulado
  let acum = 0;
  const acumData = sorted.map((r) => {
    acum += r.carnets;
    return { mes: `${r.mesLabel} ${String(r.anio).slice(-2)}`, acumulado: acum };
  });

  const charts = [
    {
      id: 'por-mes',
      type: 'line',
      title: 'Carnets emitidos por mes',
      subtitle: 'Evolución mensual de la emisión de carnets de manipulación segura de alimentos.',
      data: mensualData,
      config: { indexBy: 'mes', keys: ['carnets'] },
    },
    {
      id: 'acumulado',
      type: 'area',
      title: 'Carnets acumulados',
      subtitle: 'Total acumulado de carnets emitidos en el período.',
      data: acumData,
      config: { indexBy: 'mes', keys: ['acumulado'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Carnets de Manipulación de Alimentos',
      category: 'salud-desarrollo-humano',
      description:
        'Carnets de manipulación segura de alimentos emitidos por el municipio: documento obligatorio para personal de comercios alimentarios, gastronomía y eventos.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ total, pico, promedio, ultimoConDatos });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, pico, promedio, ultimoConDatos }) {
  return `## Resumen

El municipio emitió **${formatNumberAR(total)} carnets de manipulación segura de alimentos** en el período. El promedio mensual fue de **${formatNumberAR(Math.round(promedio))} carnets** y el mes pico fue **${pico ? `${pico.mesLabel} ${pico.anio}` : '—'}** con **${formatNumberAR(pico?.carnets || 0)} carnets** emitidos.

## Qué es el carnet

El carnet de **manipulación segura de alimentos** es un documento obligatorio para todas las personas que trabajan en contacto con alimentos: cocineros, mozos, vendedores de comercios alimentarios, organizadores de eventos gastronómicos, y empleados de fábricas o plantas procesadoras. Se obtiene tras un curso teórico-práctico que cubre higiene, conservación, contaminación cruzada y manejo de cadena de frío.

## Estacionalidad

Los meses con mayor demanda suelen coincidir con campañas de regularización del personal en comercios y con la apertura de la temporada turística-gastronómica. Los meses de menor actividad suelen ser enero (vacaciones) y julio (receso invernal).

## Rol del municipio

El curso y la emisión del carnet son competencia municipal, en articulación con la Subsecretaría de Salud Pública. La fiscalización del uso del carnet en los comercios la realiza el área de bromatología municipal mediante inspecciones rutinarias.

## Sobre los datos

El registro contiene la cantidad de carnets emitidos por mes (formato YYYY-MM). No incluye datos personales ni del comercio donde trabaja el manipulador.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
