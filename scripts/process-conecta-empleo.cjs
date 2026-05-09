/**
 * Procesa el dataset "capacitaciones-conecta-empleo".
 * - Lee 6 archivos anuales (2020-2025): cada fila es un capacitado individual.
 * - Estructura: genero (M/F), capacitación, año, carga_horaria, instructor, institución_empresa.
 * - KPIs: total capacitados, capacitaciones distintas, % mujeres, instituciones.
 * - Charts: capacitados por año, género, top capacitaciones.
 */

const {
  readCSV,
  extractYearFromPath,
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

const REPORT_ID = 'hacienda-economia/conecta-empleo';
const CKAN_ID = 'capacitaciones-conecta-empleo';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const anioFile = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const anio = parseInt(String(r['año'] || r.anio || anioFile), 10) || anioFile;
      all.push({
        genero: String(r.genero || '').trim().toUpperCase(),
        capacitacion: String(r['capacitación'] || r.capacitacion || '').trim(),
        anio,
        institucion: String(r['institución_empresa'] || r.institucion_empresa || '').trim(),
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const total = all.length;
  const capacitacionesDistintas = new Set(all.map((r) => r.capacitacion).filter(Boolean)).size;
  const institucionesDistintas = new Set(all.map((r) => r.institucion).filter(Boolean)).size;

  const generoCounts = countBy(all, (r) => r.genero);
  const femeninos = generoCounts.get('F') || 0;
  const masculinos = generoCounts.get('M') || 0;
  const conGenero = femeninos + masculinos;
  const pctFemenino = conGenero > 0 ? (femeninos / conGenero) * 100 : 0;

  const kpis = [
    buildKPI({
      id: 'total-capacitados',
      label: 'Capacitados',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'personas',
      hint: 'Suma de inscripciones (una persona puede aparecer en varios cursos).',
    }),
    buildKPI({
      id: 'capacitaciones-distintas',
      label: 'Capacitaciones distintas',
      value: capacitacionesDistintas,
      formatted: formatNumberAR(capacitacionesDistintas),
      hint: 'Diversidad del catálogo de cursos.',
    }),
    buildKPI({
      id: 'pct-mujeres',
      label: 'Mujeres capacitadas',
      value: pctFemenino,
      formatted: formatPercentAR(pctFemenino, 1),
      hint: `${formatNumberAR(femeninos)} de ${formatNumberAR(conGenero)} con género declarado.`,
    }),
    buildKPI({
      id: 'instituciones',
      label: 'Instituciones articuladoras',
      value: institucionesDistintas,
      formatted: formatNumberAR(institucionesDistintas),
      hint: 'Empresas u organismos que articulan capacitaciones.',
    }),
  ];

  // ─── Charts ───

  // 1. Capacitados por año
  const porAnio = countBy(all, (r) => r.anio);
  const yearsSorted = [...porAnio.keys()].filter(Boolean).sort((a, b) => a - b);
  const anioData = yearsSorted.map((y) => ({ anio: String(y), capacitados: porAnio.get(y) || 0 }));

  // 2. Género (pie)
  const generoData = [
    { id: 'Femenino', label: 'Femenino', value: femeninos },
    { id: 'Masculino', label: 'Masculino', value: masculinos },
  ].filter((d) => d.value > 0);

  // 3. Top capacitaciones (horizontalBar)
  const capCounts = countBy(
    all.filter((r) => r.capacitacion),
    (r) => r.capacitacion,
  );
  const topCap = [...capCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([cap, count]) => ({
      capacitacion: cap.length > 38 ? cap.slice(0, 36) + '…' : cap,
      capacitados: count,
    }));

  const charts = [];

  if (anioData.some((d) => d.capacitados > 0)) {
    charts.push({
      id: 'capacitados-anio',
      type: 'area',
      title: 'Capacitados por año',
      subtitle: 'Evolución del programa Conecta Empleo en cantidad de personas alcanzadas.',
      data: anioData,
      config: { indexBy: 'anio', keys: ['capacitados'] },
    });
  }

  if (generoData.length > 0) {
    charts.push({
      id: 'genero',
      type: 'pie',
      title: 'Capacitados por género',
      subtitle: 'Participación femenina y masculina en el programa.',
      data: generoData,
      config: {},
    });
  }

  if (topCap.length > 0) {
    charts.push({
      id: 'top-capacitaciones',
      type: 'horizontalBar',
      title: 'Capacitaciones con mayor convocatoria (top 12)',
      subtitle: 'Cursos con más participantes en el período.',
      data: topCap,
      config: { indexBy: 'capacitacion', keys: ['capacitados'] },
    });
  }

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Capacitaciones Conecta Empleo',
      category: 'hacienda-economia',
      description:
        'Programa Conecta Empleo: capacitaciones laborales y técnicas articuladas por la Secretaría de Desarrollo Productivo con empresas y organismos del medio para mejorar la empleabilidad.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    total,
    capacitacionesDistintas,
    pctFemenino,
    institucionesDistintas,
    yearsRange: yearsSorted.length > 0 ? `${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}` : '—',
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, capacitacionesDistintas, pctFemenino, institucionesDistintas, yearsRange }) {
  return `## Resumen

Entre **${yearsRange}**, el programa **Conecta Empleo** registró **${formatNumberAR(total)} inscripciones** en **${formatNumberAR(capacitacionesDistintas)} capacitaciones** distintas, articuladas con **${formatNumberAR(institucionesDistintas)} instituciones, empresas u organismos** del medio.

## Foco en empleabilidad

Conecta Empleo es un programa de la Secretaría de Desarrollo Productivo orientado a mejorar las competencias laborales de jóvenes y adultos en oficios y rubros con demanda local: agroindustria, construcción, servicios, manipulación segura de alimentos, conducción de maquinaria, ofimática y emprendedurismo, entre otros.

## Participación femenina

**${formatPercentAR(pctFemenino, 1)}** de los participantes con género declarado son mujeres. El número refleja tanto la composición de la oferta (algunos rubros son masculinizados, otros feminizados) como las políticas de inclusión laboral.

## Articulación público-privada

El modelo del programa es de articulación: el municipio convoca, las empresas brindan capacitadores y prácticas, las instituciones técnicas dictan contenidos. Cada registro de capacitado lleva la institución que articuló.

## Sobre los datos

Cada fila representa una **inscripción** (una persona en un curso). Una misma persona puede aparecer en varios registros si tomó varios cursos. Por eso la cifra de "capacitados" representa convocatorias acumuladas, no individuos únicos.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
