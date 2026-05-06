/**
 * Análisis ejecutivo de VIVIENDA Y TERRITORIO.
 * Sintetiza: Programa Nuestro Terreno (5 archivos anuales).
 */

const {
  readCSV, parseSpanishNumber, extractYearFromPath, countBy, sumBy,
  writeJSON, writeMarkdown, loadManifest, findDataset, localPath,
  formatNumberAR, formatPercentAR, buildKPI, buildMeta,
} = require('./lib/csv-utils.cjs');

const SLUG = 'vivienda-territorio';

function run() {
  console.log(`\n  → ${SLUG} (resumen ejecutivo)`);
  const m = loadManifest();
  const ntDs = findDataset(m, 'beneficiarios-programa-nuestro-terreno');

  // ── Beneficiarios Nuestro Terreno por año ──────────────
  const ntByYear = new Map();
  let total = 0;
  let titulares = 0, suplentes = 0;
  let mujeres = 0, varones = 0;
  let edades = [];
  const tiposSorteo = new Map();
  const situacionesHab = new Map();
  let integrantesTotal = 0;
  let conIntegrantes = 0;

  for (const res of ntDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    ntByYear.set(year, rows.length);
    total += rows.length;
    for (const r of rows) {
      const cond = String(r.condicion_sorteo || '').toUpperCase().trim();
      if (cond === 'TITULAR') titulares += 1;
      if (cond === 'SUPLENTE') suplentes += 1;
      const g = String(r.genero_titular_inscripcion || '').toUpperCase().trim();
      if (g === 'FEMENINO' || g === 'F') mujeres += 1;
      if (g === 'MASCULINO' || g === 'M') varones += 1;
      const edad = parseSpanishNumber(r.edad_titular_inscripcion);
      if (Number.isFinite(edad) && edad > 0 && edad < 120) edades.push(edad);
      const tipo = String(r.tipo_sorteo || '').trim();
      if (tipo) tiposSorteo.set(tipo, (tiposSorteo.get(tipo) || 0) + 1);
      const sit = String(r.situacion_habitacional || '').trim();
      if (sit && sit !== 'NO_APLICA') situacionesHab.set(sit, (situacionesHab.get(sit) || 0) + 1);
      const integ = parseSpanishNumber(r.cantidad_integrantes_grupo_familiar);
      if (Number.isFinite(integ) && integ > 0) {
        integrantesTotal += integ;
        conIntegrantes += 1;
      }
    }
  }
  const edadPromedio = edades.length > 0 ? edades.reduce((a, b) => a + b, 0) / edades.length : 0;
  const integrantesPromedio = conIntegrantes > 0 ? integrantesTotal / conIntegrantes : 0;
  const pctMujeres = (mujeres + varones) > 0 ? (mujeres / (mujeres + varones)) * 100 : 0;
  const pctTitulares = total > 0 ? (titulares / total) * 100 : 0;

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'beneficiarios-total',
      label: 'Beneficiarios acumulados',
      value: total,
      formatted: formatNumberAR(total),
      hint: `Programa Nuestro Terreno · 2021-2025`,
      status: 'good',
    }),
    buildKPI({
      id: 'titulares',
      label: 'Titulares de sorteo',
      value: titulares,
      formatted: formatNumberAR(titulares),
      hint: `${pctTitulares.toFixed(1).replace('.', ',')}% del total · ${formatNumberAR(suplentes)} suplentes`,
    }),
    buildKPI({
      id: 'mujeres',
      label: 'Titulares mujeres',
      value: Number(pctMujeres.toFixed(1)),
      formatted: formatPercentAR(pctMujeres, 1),
      hint: `${formatNumberAR(mujeres)} mujeres · ${formatNumberAR(varones)} varones`,
    }),
    buildKPI({
      id: 'edad-prom',
      label: 'Edad promedio del titular',
      value: Number(edadPromedio.toFixed(1)),
      formatted: edadPromedio.toFixed(1).replace('.', ','),
      unit: 'años',
      hint: `${integrantesPromedio.toFixed(1).replace('.', ',')} integrantes promedio por grupo familiar`,
    }),
  ];

  // ── Charts ─────────────────────────────────────────────
  const beneficiariosYearData = [...ntByYear.keys()].sort().map(y => ({
    anio: String(y),
    titulares: 0,
    suplentes: 0,
  }));
  // Recalcular titulares/suplentes por año
  for (const res of ntDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    const entry = beneficiariosYearData.find(x => x.anio === String(year));
    if (!entry) continue;
    for (const r of rows) {
      const cond = String(r.condicion_sorteo || '').toUpperCase().trim();
      if (cond === 'TITULAR') entry.titulares += 1;
      else if (cond === 'SUPLENTE') entry.suplentes += 1;
    }
  }

  const tipoSorteoData = [...tiposSorteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: id.length > 30 ? id.slice(0, 28) + '…' : id, value }));

  const situacionData = [...situacionesHab.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([sit, n]) => ({ sit: sit.length > 30 ? sit.slice(0, 28) + '…' : sit, beneficiarios: n }));

  const generoData = [
    { id: 'Femenino', label: 'Femenino', value: mujeres },
    { id: 'Masculino', label: 'Masculino', value: varones },
  ].filter(x => x.value > 0);

  const charts = [
    {
      id: 'beneficiarios-yoy',
      type: 'stackedBar',
      title: 'Beneficiarios Nuestro Terreno por año',
      subtitle: 'Titulares y suplentes adjudicados por sorteo.',
      data: beneficiariosYearData,
      config: { indexBy: 'anio', keys: ['titulares', 'suplentes'] },
    },
    {
      id: 'tipo-sorteo',
      type: 'pie',
      title: 'Composición por tipo de sorteo',
      subtitle: 'Sorteos generales, individuales, cupos por discapacidad y otros.',
      data: tipoSorteoData,
    },
    {
      id: 'situacion-hab',
      type: 'horizontalBar',
      title: 'Situación habitacional al inscribirse',
      subtitle: 'Condición de tenencia de la vivienda al momento del sorteo.',
      data: situacionData,
      config: { indexBy: 'sit', keys: ['beneficiarios'] },
    },
    {
      id: 'genero',
      type: 'pie',
      title: 'Titulares por género',
      subtitle: 'Composición demográfica del programa.',
      data: generoData,
    },
  ];

  // ── Output ────────────────────────────────────────────
  const data = {
    meta: buildMeta({
      id: SLUG,
      title: 'Vivienda y Territorio · Resumen ejecutivo',
      category: SLUG,
      description:
        'Programa Nuestro Terreno: política habitacional municipal de adjudicación de lotes por sorteo público.',
      manifestEntry: {
        source_url: 'https://datos-abiertos.venadotuerto.gob.ar/',
        license: 'CC-BY / ODC-BY',
        last_updated: ntDs.last_updated,
        organization: 'Intendencia y Gabinete',
        notes: '',
      },
    }),
    kpis, charts,
  };
  writeJSON(`public/data/${SLUG}/_resumen.json`, data);

  writeMarkdown(`public/reports/${SLUG}/_resumen.md`, renderMarkdown({
    total, titulares, suplentes, pctTitulares, pctMujeres, edadPromedio,
    integrantesPromedio,
  }));

  console.log(`    ✓ ${SLUG}/_resumen (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown(d) {
  return `## Política habitacional municipal

El programa **Nuestro Terreno** —principal instrumento habitacional del municipio— adjudicó **${formatNumberAR(d.total)} beneficios** entre 2021 y 2025, mediante **sorteos públicos** que reparten lotes urbanizados a familias de la ciudad. De ese total, **${formatNumberAR(d.titulares)} son titulares directos** (${d.pctTitulares.toFixed(1).replace('.', ',')}%) y **${formatNumberAR(d.suplentes)} son suplentes** (acceden si los titulares no completan los requisitos).

## Perfil de los beneficiarios

La **edad promedio del titular** al inscribirse es de **${d.edadPromedio.toFixed(1).replace('.', ',')} años**, con grupos familiares de **${d.integrantesPromedio.toFixed(1).replace('.', ',')} personas en promedio**. La participación femenina alcanza el **${d.pctMujeres.toFixed(1).replace('.', ',')}%** del total de titulares, lo que refleja el rol creciente de las mujeres como **jefas de hogar inscriptas** en programas de vivienda.

## Situación habitacional previa

Los beneficiarios provienen de distintas situaciones: alquiler, propiedad ocupada de hecho, propiedad prestada o cedida, propiedad compartida, entre otras. El gráfico permite identificar **el principal foco de demanda** —generalmente alquiler— y dimensionar el problema habitacional que el programa busca resolver.

## Lectura

Nuestro Terreno es una **política de mediano plazo**: los lotes adjudicados deben ser construidos por sus titulares en plazos definidos. Estos datos miden la dimensión **adjudicación**; análisis complementarios deberían incluir tiempos hasta construcción, tasa de cumplimiento y desistimientos.
`;
}

module.exports = run;
if (require.main === module) run();
