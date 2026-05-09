/**
 * Procesa el dataset "oferta-educativa-terciaria-y-universitaria-en-venado-tuerto".
 * - Lee 4 archivos: nivel-inicial, primarias, secundarias, terciarias-y-universitarias.
 * - Estructuras distintas: en terciarias cada fila es una CARRERA;
 *   en los otros cada fila es un ESTABLECIMIENTO.
 * - KPIs: total instituciones, % públicas, niveles, total carreras.
 * - Charts: instituciones por nivel, gestión, áreas de interés.
 * - Tabla: instituciones terciarias y universitarias.
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

const REPORT_ID = 'educacion/oferta-educativa';
const CKAN_ID = 'oferta-educativa-terciaria-y-universitaria-en-venado-tuerto';

function findRes(ds, regex) {
  return ds.resources.find((r) => regex.test(r.local_path));
}

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const inicialRes = findRes(ds, /nivel-inicial/i);
  const primariaRes = findRes(ds, /escuelas-primarias/i);
  const secundariaRes = findRes(ds, /escuelas-secundarias/i);
  const terciariaRes = findRes(ds, /instituciones-educativas-terciarias-y-universitarias/i);

  // Leer establecimientos por nivel (cada fila = un establecimiento)
  const inicial = inicialRes ? readCSV(localPath(inicialRes)).map((r) => normEstab(r, 'Inicial')) : [];
  const primaria = primariaRes ? readCSV(localPath(primariaRes)).map((r) => normEstab(r, 'Primario')) : [];
  const secundaria = secundariaRes ? readCSV(localPath(secundariaRes)).map((r) => normEstab(r, 'Secundario')) : [];

  // Terciarias: agrupar carreras por institución
  const carreras = terciariaRes
    ? readCSV(localPath(terciariaRes)).map((r) => ({
        institucion: String(r.institucion || '').trim(),
        nivel: String(r.nivel || '').trim() || 'Terciario/Universitario',
        tipoGestion: String(r.tipo_gestion || r['tipo_gestión'] || '').trim(),
        carrera: String(r.nombre_carrera || '').trim(),
        modalidad: String(r.modalidad || '').trim(),
        areaInteres: String(r.area_de_interes || '').trim(),
      }))
    : [];

  // Conjunto de instituciones terciarias-univ únicas
  const tercInstMap = new Map();
  for (const c of carreras) {
    if (!c.institucion) continue;
    if (!tercInstMap.has(c.institucion)) {
      tercInstMap.set(c.institucion, {
        institucion: c.institucion,
        nivel: c.nivel,
        tipoGestion: c.tipoGestion,
        carreras: [],
      });
    }
    if (c.carrera) tercInstMap.get(c.institucion).carreras.push(c.carrera);
  }
  const tercInst = [...tercInstMap.values()];

  const todasInstituciones = [...inicial, ...primaria, ...secundaria, ...tercInst];

  console.log(`    inicial:${inicial.length} primaria:${primaria.length} secundaria:${secundaria.length} terc-univ:${tercInst.length} (carreras:${carreras.length})`);

  // ─── KPIs ───
  const totalInst = todasInstituciones.length;
  const publicas = todasInstituciones.filter((i) => /pública|publica/i.test(i.tipoGestion)).length;
  const pctPublicas = totalInst > 0 ? (publicas / totalInst) * 100 : 0;
  const nivelesDistintos = new Set(todasInstituciones.map((i) => i.nivel).filter(Boolean)).size;

  const kpis = [
    buildKPI({
      id: 'total-instituciones',
      label: 'Instituciones educativas',
      value: totalInst,
      formatted: formatNumberAR(totalInst),
      hint: 'Suma de nivel inicial, primario, secundario y terciario/universitario.',
    }),
    buildKPI({
      id: 'pct-publicas',
      label: 'Gestión pública',
      value: pctPublicas,
      formatted: formatPercentAR(pctPublicas, 1),
      hint: `${formatNumberAR(publicas)} de ${formatNumberAR(totalInst)} instituciones`,
    }),
    buildKPI({
      id: 'niveles',
      label: 'Niveles educativos',
      value: nivelesDistintos,
      formatted: formatNumberAR(nivelesDistintos),
      hint: 'Inicial, primario, secundario, terciario y universitario.',
    }),
    buildKPI({
      id: 'carreras-terciarias',
      label: 'Carreras terciarias y universitarias',
      value: carreras.length,
      formatted: formatNumberAR(carreras.length),
      hint: 'Tecnicaturas, profesorados, licenciaturas y carreras universitarias.',
    }),
  ];

  // ─── Charts ───

  // 1. Instituciones por nivel
  const nivelCounts = countBy(
    todasInstituciones.filter((i) => i.nivel),
    (i) => normNivel(i.nivel),
  );
  const nivelData = [...nivelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => ({ nivel: n, instituciones: c }));

  // 2. Gestión (pie)
  const gestionCounts = countBy(
    todasInstituciones.filter((i) => i.tipoGestion),
    (i) => normGestion(i.tipoGestion),
  );
  const gestionData = [...gestionCounts.entries()]
    .map(([g, c]) => ({ id: g, label: g, value: c }))
    .filter((d) => d.value > 0);

  // 3. Áreas de interés (carreras terciarias)
  const areaCounts = countBy(
    carreras.filter((c) => c.areaInteres),
    (c) => c.areaInteres,
  );
  const areaData = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a, c]) => ({
      area: a.length > 38 ? a.slice(0, 36) + '…' : a,
      carreras: c,
    }));

  const charts = [];

  if (nivelData.length > 0) {
    charts.push({
      id: 'instituciones-por-nivel',
      type: 'bar',
      title: 'Instituciones por nivel educativo',
      subtitle: 'Cantidad de establecimientos en cada nivel.',
      data: nivelData,
      config: { indexBy: 'nivel', keys: ['instituciones'] },
    });
  }

  if (gestionData.length > 0) {
    charts.push({
      id: 'gestion',
      type: 'pie',
      title: 'Distribución por tipo de gestión',
      subtitle: 'Pública vs. privada (todas las instituciones).',
      data: gestionData,
      config: {},
    });
  }

  if (areaData.length > 0) {
    charts.push({
      id: 'areas-interes',
      type: 'horizontalBar',
      title: 'Carreras terciarias por área de interés',
      subtitle: 'Diversidad temática de la oferta de educación superior.',
      data: areaData,
      config: { indexBy: 'area', keys: ['carreras'] },
    });
  }

  // ─── Tabla: Instituciones terciarias-universitarias ───
  const tableRows = tercInst
    .sort((a, b) => a.institucion.localeCompare(b.institucion))
    .map((i) => [i.institucion, i.tipoGestion || '—', formatNumberAR(i.carreras.length)]);

  const tables = [];
  if (tableRows.length > 0) {
    tables.push({
      id: 'terciarias-univ',
      title: 'Instituciones terciarias y universitarias',
      columns: ['Institución', 'Gestión', 'Carreras ofrecidas'],
      rows: tableRows,
    });
  }

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Oferta Educativa',
      category: 'educacion',
      description:
        'Oferta educativa de Venado Tuerto: jardines de infantes, escuelas primarias y secundarias, e instituciones terciarias y universitarias con sus carreras, áreas de interés y modalidad.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ totalInst, publicas, pctPublicas, nivelesDistintos, carrerasTotal: carreras.length, tercInstCount: tercInst.length });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function normEstab(r, nivelDefault) {
  return {
    institucion: String(r.institucion || '').trim(),
    nivel: String(r.nivel || '').trim() || nivelDefault,
    tipoGestion: String(r.tipo_gestion || r['tipo_gestión'] || '').trim(),
  };
}

function normNivel(n) {
  const v = n.toLowerCase();
  if (v.includes('inicial')) return 'Inicial';
  if (v.includes('primari')) return 'Primario';
  if (v.includes('secundari')) return 'Secundario';
  if (v.includes('univers')) return 'Universitario';
  if (v.includes('terciari')) return 'Terciario';
  return n;
}

function normGestion(g) {
  const v = g.toLowerCase();
  if (v.includes('público') || v.includes('publica') || v.includes('pública')) return 'Pública';
  if (v.includes('privad')) return 'Privada';
  return g;
}

function renderMarkdown({ totalInst, publicas, pctPublicas, nivelesDistintos, carrerasTotal, tercInstCount }) {
  return `## Resumen

Venado Tuerto cuenta con **${formatNumberAR(totalInst)} instituciones educativas** distribuidas en **${formatNumberAR(nivelesDistintos)} niveles** (inicial, primario, secundario, terciario y universitario). De estas, **${formatNumberAR(publicas)}** son de gestión pública (${formatPercentAR(pctPublicas, 1)}) y el resto, privadas o de gestión social.

## Educación superior

La ciudad ofrece **${formatNumberAR(carrerasTotal)} carreras terciarias y universitarias** distribuidas en **${formatNumberAR(tercInstCount)} instituciones**. Entre ellas hay tecnicaturas superiores, profesorados, licenciaturas y carreras universitarias completas, lo que la posiciona como un polo educativo regional para el sur de Santa Fe.

## Áreas de interés

Las carreras se agrupan en áreas de interés que abarcan: ciencias sociales y humanas, ciencias económicas, ciencias biológicas y de la salud, ingeniería y tecnología, agro y producción, y educación. Esta diversidad permite a los estudiantes locales formarse sin necesidad de trasladarse a Rosario o Córdoba.

## Distribución pública/privada

La proporción de instituciones públicas (${formatPercentAR(pctPublicas, 0)}) refleja el rol del Estado provincial y nacional como principal proveedor de educación, complementado por instituciones privadas con énfasis en niveles secundario y superior.

## Sobre los datos

El dataset combina cuatro registros: nivel inicial, escuelas primarias, escuelas secundarias e instituciones terciarias/universitarias. Para cada institución se incluye dirección, teléfono, tipo de gestión y, en el caso de la educación superior, el listado de carreras ofrecidas con su modalidad, duración y área temática.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
