/**
 * Procesa el dataset "becados-2025".
 * - Lee 1 archivo: 678 becas individuales (genero, nivel, institucion, año_en_curso, carrera).
 * - KPIs: total becados, niveles, instituciones, % femenino.
 * - Charts: bar por nivel, pie género, horizontalBar instituciones top.
 */

const {
  readCSV,
  countBy,
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

const REPORT_ID = 'educacion/becados';
const CKAN_ID = 'becados-2025';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => ({
    genero: String(r.genero || '').trim(),
    nivel: String(r.nivel || '').trim(),
    institucion: String(r.institucion || '').trim(),
    anioCurso: String(r['año_en_curso'] || r.anio_en_curso || '').trim(),
    carrera: String(r.carrera || '').trim(),
  })).filter((r) => r.nivel || r.institucion);

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const total = rows.length;
  const nivelesDistintos = new Set(rows.map((r) => r.nivel).filter(Boolean)).size;
  const institucionesDistintas = new Set(rows.map((r) => r.institucion).filter(Boolean)).size;

  const generoCounts = countBy(
    rows.filter((r) => r.genero),
    (r) => r.genero,
  );
  const femenino = generoCounts.get('Femenino') || 0;
  const masculino = generoCounts.get('Masculino') || 0;
  const conGenero = femenino + masculino;
  const pctFemenino = conGenero > 0 ? (femenino / conGenero) * 100 : 0;

  const kpis = [
    buildKPI({
      id: 'total-becados',
      label: 'Becados',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'beneficiarios',
    }),
    buildKPI({
      id: 'niveles',
      label: 'Niveles educativos',
      value: nivelesDistintos,
      formatted: formatNumberAR(nivelesDistintos),
      hint: 'Niveles cubiertos por el programa de becas.',
    }),
    buildKPI({
      id: 'instituciones',
      label: 'Instituciones alcanzadas',
      value: institucionesDistintas,
      formatted: formatNumberAR(institucionesDistintas),
      hint: 'Escuelas y centros donde estudian los becados.',
    }),
    buildKPI({
      id: 'pct-femenino',
      label: 'Becadas mujeres',
      value: pctFemenino,
      formatted: formatPercentAR(pctFemenino, 1),
      hint: `${formatNumberAR(femenino)} de ${formatNumberAR(conGenero)} con género declarado.`,
    }),
  ];

  // ─── Charts ───

  // 1. Por nivel
  const nivelCounts = countBy(
    rows.filter((r) => r.nivel),
    (r) => r.nivel,
  );
  const nivelData = [...nivelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => ({ nivel: n, becados: c }));

  // 2. Género
  const generoData = [
    { id: 'Femenino', label: 'Femenino', value: femenino },
    { id: 'Masculino', label: 'Masculino', value: masculino },
  ].filter((d) => d.value > 0);

  // 3. Top instituciones
  const instCounts = countBy(
    rows.filter((r) => r.institucion),
    (r) => r.institucion,
  );
  const instData = [...instCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([i, c]) => ({
      institucion: i.length > 38 ? i.slice(0, 36) + '…' : i,
      becados: c,
    }));

  const charts = [
    {
      id: 'por-nivel',
      type: 'bar',
      title: 'Becados por nivel educativo',
      subtitle: 'Distribución de las becas según el nivel del estudiante.',
      data: nivelData,
      config: { indexBy: 'nivel', keys: ['becados'] },
    },
    ...(generoData.length > 0
      ? [
          {
            id: 'genero',
            type: 'pie',
            title: 'Becados por género',
            subtitle: 'Participación femenina y masculina en el programa.',
            data: generoData,
            config: {},
          },
        ]
      : []),
    {
      id: 'top-instituciones',
      type: 'horizontalBar',
      title: 'Instituciones con más becados (top 12)',
      subtitle: 'Escuelas y centros donde estudian los beneficiarios del programa.',
      data: instData,
      config: { indexBy: 'institucion', keys: ['becados'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Becados Municipales',
      category: 'educacion',
      description:
        'Programa municipal de becas estudiantiles: beneficiarios por nivel, institución educativa, carrera y género. Una herramienta de inclusión para sostener la trayectoria escolar y formativa.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ total, nivelesDistintos, institucionesDistintas, pctFemenino });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, nivelesDistintos, institucionesDistintas, pctFemenino }) {
  return `## Resumen

El programa municipal de becas alcanzó a **${formatNumberAR(total)} estudiantes** en **${formatNumberAR(nivelesDistintos)} niveles educativos** distintos, distribuidos en **${formatNumberAR(institucionesDistintas)} instituciones**. **${formatPercentAR(pctFemenino, 1)}** de los becados son mujeres.

## Cobertura por nivel

Las becas cubren todos los niveles formativos: inicial, primario, secundario, terciario y universitario. La mayor concentración suele estar en los niveles obligatorios (primario y secundario), donde el municipio acompaña a familias en situación de vulnerabilidad para sostener la asistencia escolar.

## Articulación con instituciones

El programa funciona en articulación con escuelas e instituciones educativas: cada beneficiario está matriculado en una institución concreta, lo que permite verificar la trayectoria académica y reorientar apoyos cuando es necesario.

## Sobre los datos

Cada registro identifica al beneficiario por nivel, institución, año/grado en curso y carrera (cuando corresponde, en niveles terciario/universitario), junto con el género autoinformado. No incluye datos personales identificatorios para preservar la privacidad de los beneficiarios.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
