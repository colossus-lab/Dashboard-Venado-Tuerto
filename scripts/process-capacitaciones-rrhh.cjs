/**
 * Procesa el dataset "capacitaciones-al-personal-2021" del portal CKAN de Venado Tuerto.
 * - Lee 5 archivos anuales (2021-2025): cap-rrhh-YYYY.csv
 * - Calcula KPIs (total capacitaciones, agentes capacitados, áreas, % presencial).
 * - Charts: capacitaciones por año, top áreas temáticas, modalidad.
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
  formatPercentAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'gobierno/capacitaciones-rrhh';
const CKAN_ID = 'capacitaciones-al-personal-2021';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  // Combinar todos los archivos anuales
  const all = [];
  for (const res of ds.resources) {
    const anio = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      all.push({
        anio,
        nombre: String(r.nombre_capacitacion || '').trim(),
        area: String(r.area_tematica || '').trim(),
        agentes: parseSpanishNumber(r.agentes_capacitados),
        modalidad: String(r.modalidad || '').trim(),
        organizador: String(r.organizador || '').trim(),
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const totalCap = all.length;
  const totalAgentes = sumBy(all, (r) => (Number.isFinite(r.agentes) ? r.agentes : 0));
  const areasDistintas = new Set(all.map((r) => r.area).filter(Boolean)).size;

  const modalidadCounts = countBy(
    all.filter((r) => r.modalidad),
    (r) => {
      const m = r.modalidad.toLowerCase();
      if (m.includes('presencial') && m.includes('virtual')) return 'Mixta';
      if (m.includes('presencial')) return 'Presencial';
      if (m.includes('virtual')) return 'Virtual';
      return r.modalidad;
    },
  );
  const presencial = modalidadCounts.get('Presencial') || 0;
  const conModalidad = [...modalidadCounts.values()].reduce((a, b) => a + b, 0);
  const pctPresencial = conModalidad > 0 ? (presencial / conModalidad) * 100 : 0;

  const kpis = [
    buildKPI({
      id: 'total-capacitaciones',
      label: 'Capacitaciones (2021–2025)',
      value: totalCap,
      formatted: formatNumberAR(totalCap),
      unit: 'eventos',
    }),
    buildKPI({
      id: 'total-agentes',
      label: 'Agentes capacitados',
      value: totalAgentes,
      formatted: formatNumberAR(totalAgentes),
      hint: 'Suma de participantes en todas las capacitaciones (puede contar repetidos).',
    }),
    buildKPI({
      id: 'areas',
      label: 'Áreas temáticas',
      value: areasDistintas,
      formatted: formatNumberAR(areasDistintas),
      hint: 'Diversidad temática del programa de capacitación.',
    }),
    buildKPI({
      id: 'pct-presencial',
      label: 'Modalidad presencial',
      value: pctPresencial,
      formatted: formatPercentAR(pctPresencial, 1),
      hint: `${formatNumberAR(presencial)} de ${formatNumberAR(conModalidad)} eventos con modalidad declarada.`,
    }),
  ];

  // ─── Charts ───

  // 1. Capacitaciones por año (área)
  const capPorAnio = countBy(all, (r) => r.anio);
  const yearsSorted = [...capPorAnio.keys()].filter(Boolean).sort((a, b) => a - b);
  const capAnioData = yearsSorted.map((y) => ({
    anio: String(y),
    capacitaciones: capPorAnio.get(y) || 0,
  }));

  // 2. Top áreas temáticas (bar)
  const areaCounts = countBy(
    all.filter((r) => r.area),
    (r) => r.area,
  );
  const areaData = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([area, count]) => ({
      area: area.length > 35 ? area.slice(0, 33) + '…' : area,
      eventos: count,
    }));

  // 3. Modalidad (pie)
  const modalidadData = [...modalidadCounts.entries()]
    .filter(([k, v]) => k && v > 0)
    .map(([k, v]) => ({ id: k, label: k, value: v }));

  const charts = [];

  if (capAnioData.some((d) => d.capacitaciones > 0)) {
    charts.push({
      id: 'cap-por-anio',
      type: 'area',
      title: 'Capacitaciones realizadas por año',
      subtitle: 'Cantidad de eventos formativos organizados o auspiciados por el municipio.',
      data: capAnioData,
      config: { indexBy: 'anio', keys: ['capacitaciones'] },
    });
  }

  if (areaData.length > 0) {
    charts.push({
      id: 'top-areas',
      type: 'horizontalBar',
      title: 'Capacitaciones por área temática (top 10)',
      subtitle: 'Las temáticas más frecuentes del programa de capacitación.',
      data: areaData,
      config: { indexBy: 'area', keys: ['eventos'] },
    });
  }

  if (modalidadData.length > 0) {
    charts.push({
      id: 'modalidad',
      type: 'pie',
      title: 'Modalidad de las capacitaciones',
      subtitle: 'Distribución entre presencial, virtual y mixta.',
      data: modalidadData,
      config: {},
    });
  }

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Capacitaciones al Personal',
      category: 'gobierno',
      description:
        'Capacitaciones organizadas o auspiciadas por la Dirección de Recursos Humanos para los agentes municipales: nombre, área temática, agentes participantes, modalidad y organizador.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    totalCap,
    totalAgentes,
    areasDistintas,
    pctPresencial,
    yearMin: yearsSorted[0],
    yearMax: yearsSorted[yearsSorted.length - 1],
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ totalCap, totalAgentes, areasDistintas, pctPresencial, yearMin, yearMax }) {
  return `## Resumen

Entre **${yearMin || 2021}** y **${yearMax || 2025}**, el municipio organizó o auspició **${formatNumberAR(totalCap)} capacitaciones** dirigidas a los agentes municipales, con un total de **${formatNumberAR(totalAgentes)} participaciones** registradas (un agente puede aparecer en más de una capacitación).

## Áreas temáticas

Las capacitaciones cubren **${formatNumberAR(areasDistintas)} áreas temáticas** distintas: desde competencias técnicas específicas (administración tributaria, mantenimiento, conducción) hasta temas transversales (género, atención al público, salud y seguridad laboral).

## Modalidad

**${formatPercentAR(pctPresencial, 1)}** de las capacitaciones se dictan en modalidad presencial. El resto se distribuye entre virtuales (videoconferencia, plataformas online) y mixtas, con creciente peso de las modalidades virtuales desde 2020.

## Sobre los datos

Cada registro incluye fecha (mes/año), nombre del curso, área temática, áreas destinatarias, capacitador, organizador, modalidad, lugar o plataforma, duración y carga horaria. La fuente es la Dirección de Recursos Humanos del municipio.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
