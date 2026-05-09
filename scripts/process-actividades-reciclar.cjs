/**
 * Procesa el dataset "actividades-reciclar-venado-2025".
 * - Lee 1 archivo: 158 actividades (fecha, actividad, tipo_receptor, nombre_receptor,
 *   ubicacion, barrio, cantidad_asistentes, rango_etario).
 * - KPIs: total actividades, asistentes totales, barrios alcanzados, top tipo receptor.
 * - Charts: pie tipo receptor, pie rango etario, horizontalBar barrios.
 */

const {
  readCSV,
  parseSpanishNumber,
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

const REPORT_ID = 'ambiente/actividades-reciclar';
const CKAN_ID = 'actividades-reciclar-venado-2025';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => ({
    actividad: String(r.actividad || '').trim(),
    tipoReceptor: String(r.tipo_receptor || '').trim(),
    barrio: String(r.barrio || '').trim(),
    asistentes: parseSpanishNumber(r.cantidad_asistentes) || 0,
    rangoEtario: String(r.rango_etario || '').trim(),
  })).filter((r) => r.actividad || r.tipoReceptor);

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const totalActividades = rows.length;
  const totalAsistentes = sumBy(rows, (r) => r.asistentes);
  const barriosDistintos = new Set(rows.map((r) => r.barrio).filter(Boolean)).size;

  const tipoCounts = countBy(
    rows.filter((r) => r.tipoReceptor),
    (r) => r.tipoReceptor,
  );
  const topTipo = [...tipoCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const kpis = [
    buildKPI({
      id: 'total-actividades',
      label: 'Actividades realizadas',
      value: totalActividades,
      formatted: formatNumberAR(totalActividades),
      unit: 'eventos',
    }),
    buildKPI({
      id: 'asistentes',
      label: 'Asistentes totales',
      value: totalAsistentes,
      formatted: formatNumberAR(totalAsistentes),
      hint: 'Personas alcanzadas por capacitaciones, charlas y eventos.',
    }),
    buildKPI({
      id: 'barrios',
      label: 'Barrios alcanzados',
      value: barriosDistintos,
      formatted: formatNumberAR(barriosDistintos),
      hint: 'Cobertura territorial del programa.',
    }),
    buildKPI({
      id: 'top-receptor',
      label: 'Receptor más frecuente',
      value: topTipo ? topTipo[1] : 0,
      formatted: topTipo ? topTipo[0] : '—',
      hint: topTipo ? `${formatNumberAR(topTipo[1])} actividades` : '',
    }),
  ];

  // ─── Charts ───

  // 1. Tipo receptor (pie)
  const tipoData = [...tipoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => ({ id: t, label: t, value: c }));

  // 2. Rango etario (pie)
  const rangoCounts = countBy(
    rows.filter((r) => r.rangoEtario),
    (r) => r.rangoEtario,
  );
  const rangoData = [...rangoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([r, c]) => ({ id: r, label: r, value: c }));

  // 3. Barrios (horizontalBar)
  const barrioCounts = countBy(
    rows.filter((r) => r.barrio),
    (r) => r.barrio,
  );
  const barrioData = [...barrioCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([b, c]) => ({
      barrio: b.length > 22 ? b.slice(0, 20) + '…' : b,
      actividades: c,
    }));

  const charts = [
    {
      id: 'tipo-receptor',
      type: 'pie',
      title: 'Actividades por tipo de receptor',
      subtitle: 'Escuelas, empresas, vecinales, colonias, organismos públicos.',
      data: tipoData,
      config: {},
    },
    {
      id: 'rango-etario',
      type: 'pie',
      title: 'Actividades por rango etario',
      subtitle: 'Público alcanzado: niños, adolescentes, adultos.',
      data: rangoData,
      config: {},
    },
    {
      id: 'barrios',
      type: 'horizontalBar',
      title: 'Actividades por barrio (top 15)',
      subtitle: 'Distribución territorial del programa.',
      data: barrioData,
      config: { indexBy: 'barrio', keys: ['actividades'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Actividades Reciclar Venado',
      category: 'ambiente',
      description:
        'Programa Reciclar Venado: capacitaciones, charlas, talleres y eventos de sensibilización ambiental llevados a escuelas, empresas, comisiones vecinales y otros espacios.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ totalActividades, totalAsistentes, barriosDistintos, topTipo });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ totalActividades, totalAsistentes, barriosDistintos, topTipo }) {
  return `## Resumen

El programa **Reciclar Venado** llevó adelante **${formatNumberAR(totalActividades)} actividades** en 2025, alcanzando a **${formatNumberAR(totalAsistentes)} personas** en **${formatNumberAR(barriosDistintos)} barrios** distintos. ${topTipo ? `El tipo de receptor más frecuente fue **${topTipo[0]}**, con **${formatNumberAR(topTipo[1])} actividades**.` : ''}

## Tipos de actividad

El programa combina varias modalidades: **capacitaciones** sobre separación de residuos en origen, **charlas** en escuelas y colonias, **talleres** prácticos sobre compostaje y reciclado, y **eventos de aniversario** abiertos a la comunidad. Cada actividad se adapta al receptor (público infantil, adolescente o adulto) y al espacio (aula, oficina, plaza, planta de tratamiento).

## Cobertura territorial y etaria

La distribución por **barrio** refleja la lógica de territorialidad del programa: cobertura amplia con énfasis en barrios populares y zonas con mayor potencial de impacto educativo. Por **rango etario**, las actividades infantiles y juveniles tienen mayor convocatoria por su realización en colonias y escuelas, mientras que las adultas se concentran en empresas y organizaciones.

## Articulación

El programa funciona en articulación con el área de Ambiente del municipio, escuelas (a través de la Subsecretaría de Educación), empresas (con políticas de RSE), comisiones vecinales y colonias de vacaciones. Los visitantes a la planta de tratamiento son un capítulo aparte (ver el informe correspondiente).

## Sobre los datos

Cada registro identifica una actividad puntual: fecha, tipo de actividad, tipo de receptor, nombre del receptor, ubicación, barrio, cantidad de asistentes y rango etario predominante.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
