/**
 * Procesa el dataset "visitas-a-la-planta-de-tratamiento-de-residuos-solidos-urbanos-2025".
 * - Lee 1 archivo: 128 visitas (escuela_institución, año, cantidad_alumnos, fecha, turno).
 * - KPIs: total visitas, alumnos totales, instituciones, mes pico.
 * - Charts: bar visitas/mes, horizontalBar instituciones top, pie turno.
 */

const {
  readCSV,
  parseSpanishNumber,
  parseDDMMYYYY,
  countBy,
  sumBy,
  groupBy,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'ambiente/visitas-planta-tratamiento';
const CKAN_ID = 'visitas-a-la-planta-de-tratamiento-de-residuos-solidos-urbanos-2025';

const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => {
    const fecha = parseDDMMYYYY(r.fecha);
    return {
      institucion: String(r['escuela_institución'] || r.escuela_institucion || '').trim(),
      año: String(r['año'] || r.anio || '').trim(),
      alumnos: parseSpanishNumber(r.cantidad_alumnos) || 0,
      fecha,
      mesIdx: fecha ? fecha.getMonth() : -1,
      turno: String(r.turno || '').trim(),
    };
  }).filter((r) => r.institucion);

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const totalVisitas = rows.length;
  const totalAlumnos = sumBy(rows, (r) => r.alumnos);
  const institucionesDistintas = new Set(rows.map((r) => r.institucion)).size;

  const porMes = countBy(rows.filter((r) => r.mesIdx >= 0), (r) => r.mesIdx);
  let mesPicoIdx = -1;
  let mesPicoCount = 0;
  for (const [idx, count] of porMes.entries()) {
    if (count > mesPicoCount) {
      mesPicoCount = count;
      mesPicoIdx = idx;
    }
  }

  const kpis = [
    buildKPI({
      id: 'total-visitas',
      label: 'Visitas guiadas',
      value: totalVisitas,
      formatted: formatNumberAR(totalVisitas),
      unit: 'visitas',
    }),
    buildKPI({
      id: 'alumnos',
      label: 'Alumnos participantes',
      value: totalAlumnos,
      formatted: formatNumberAR(totalAlumnos),
      hint: 'Total de niños y jóvenes que conocieron la planta.',
    }),
    buildKPI({
      id: 'instituciones',
      label: 'Instituciones visitantes',
      value: institucionesDistintas,
      formatted: formatNumberAR(institucionesDistintas),
      hint: 'Escuelas y organizaciones que participaron del programa.',
    }),
    buildKPI({
      id: 'mes-pico',
      label: 'Mes pico',
      value: mesPicoCount,
      formatted: mesPicoIdx >= 0 ? MES_LABELS[mesPicoIdx] : '—',
      hint: mesPicoIdx >= 0 ? `${formatNumberAR(mesPicoCount)} visitas` : '',
    }),
  ];

  // ─── Charts ───

  // 1. Visitas por mes
  const mesData = MES_LABELS.map((m, i) => ({
    mes: m,
    visitas: porMes.get(i) || 0,
  }));

  // 2. Top instituciones
  const grouped = groupBy(rows, (r) => r.institucion);
  const instituciones = [...grouped.entries()]
    .map(([inst, items]) => ({
      institucion: inst,
      visitas: items.length,
      alumnos: items.reduce((s, r) => s + r.alumnos, 0),
    }))
    .sort((a, b) => b.alumnos - a.alumnos);

  const topInstData = instituciones.slice(0, 12).map((i) => ({
    institucion: i.institucion.length > 32 ? i.institucion.slice(0, 30) + '…' : i.institucion,
    alumnos: i.alumnos,
  }));

  // 3. Turno (pie)
  const turnoCounts = countBy(rows.filter((r) => r.turno), (r) => r.turno);
  const turnoData = [...turnoCounts.entries()]
    .map(([t, c]) => ({ id: t, label: t, value: c }))
    .filter((d) => d.value > 0);

  const charts = [
    {
      id: 'visitas-por-mes',
      type: 'bar',
      title: 'Visitas guiadas por mes',
      subtitle: 'Distribución temporal del año lectivo.',
      data: mesData,
      config: { indexBy: 'mes', keys: ['visitas'] },
    },
    {
      id: 'top-instituciones',
      type: 'horizontalBar',
      title: 'Instituciones con más alumnos visitantes (top 12)',
      subtitle: 'Cantidad acumulada de alumnos enviados a la planta.',
      data: topInstData,
      config: { indexBy: 'institucion', keys: ['alumnos'] },
    },
    ...(turnoData.length > 0
      ? [
          {
            id: 'turno',
            type: 'pie',
            title: 'Distribución por turno',
            subtitle: 'Mañana vs. tarde.',
            data: turnoData,
            config: {},
          },
        ]
      : []),
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Visitas a la Planta de Tratamiento',
      category: 'ambiente',
      description:
        'Visitas guiadas de escuelas e instituciones a la Planta de Tratamiento de Residuos Sólidos Urbanos: programa educativo-ambiental para acercar a la comunidad el destino final de la basura urbana.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    totalVisitas,
    totalAlumnos,
    institucionesDistintas,
    mesPicoIdx,
    mesPicoCount,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ totalVisitas, totalAlumnos, institucionesDistintas, mesPicoIdx, mesPicoCount }) {
  return `## Resumen

La **Planta de Tratamiento de Residuos Sólidos Urbanos** recibió **${formatNumberAR(totalVisitas)} visitas guiadas** de escuelas e instituciones, sumando **${formatNumberAR(totalAlumnos)} alumnos** de **${formatNumberAR(institucionesDistintas)} instituciones** distintas. ${mesPicoIdx >= 0 ? `El mes pico fue **${MES_LABELS[mesPicoIdx]}** con **${formatNumberAR(mesPicoCount)} visitas**.` : ''}

## Para qué sirve la visita

Las visitas guiadas son un componente central del programa de **educación ambiental** del municipio. Los alumnos recorren las distintas etapas del proceso: recolección, separación, prensado y disposición final. Conocen el rol de los **recuperadores urbanos**, ven en directo los volúmenes de residuos generados por la ciudad y aprenden cómo la separación domiciliaria puede mejorar el reciclado.

## Estacionalidad escolar

La actividad sigue el calendario lectivo: mayor concentración entre **abril y noviembre**, con valle en enero-febrero (vacaciones de verano) y receso de invierno (julio). Los meses de cierre del año (octubre-noviembre) suelen tener picos por proyectos curriculares de fin de ciclo.

## Articulación con escuelas

El municipio coordina con la Subsecretaría de Educación provincial y con cada institución la logística (transporte, autorización, horarios). Las visitas suelen acompañar contenidos curriculares (Ciencias Naturales, Educación Ambiental, Construcción de la Ciudadanía) y se complementan con materiales didácticos previos y posteriores.

## Sobre los datos

Cada registro contiene: institución visitante, año/curso (5°A, 2°B, etc.), cantidad de alumnos, fecha y turno (mañana/tarde). No discrimina por nivel educativo (primario/secundario), aunque la mayoría son escuelas primarias.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
