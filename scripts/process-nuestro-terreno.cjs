/**
 * Procesa el dataset "beneficiarios-programa-nuestro-terreno".
 * - Lee 5 archivos anuales (2021-2025): cada fila es un beneficiario
 *   (id, condicion_sorteo, tipo_sorteo, edad, genero, situacion_habitacional, integrantes).
 * - KPIs: total beneficiarios, % titulares, % femenino, edad promedio.
 * - Charts: area por año, pie tipo sorteo, pie situación, pie género.
 */

const {
  readCSV,
  parseSpanishNumber,
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

const REPORT_ID = 'vivienda-territorio/nuestro-terreno';
const CKAN_ID = 'beneficiarios-programa-nuestro-terreno';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const anio = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      all.push({
        anio,
        condicion: String(r.condicion_sorteo || '').trim().toUpperCase(),
        tipoSorteo: String(r.tipo_sorteo || '').trim().toUpperCase(),
        edad: parseSpanishNumber(r.edad_titular_inscripcion),
        genero: String(r.genero_titular_inscripcion || '').trim().toUpperCase(),
        situacion: String(r.situacion_habitacional || '').trim(),
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const total = all.length;
  const titulares = all.filter((r) => r.condicion === 'TITULAR').length;
  const pctTitulares = total > 0 ? (titulares / total) * 100 : 0;

  const femeninos = all.filter((r) => r.genero === 'FEMENINO').length;
  const masculinos = all.filter((r) => r.genero === 'MASCULINO').length;
  const conGenero = femeninos + masculinos;
  const pctFemenino = conGenero > 0 ? (femeninos / conGenero) * 100 : 0;

  const edades = all.map((r) => r.edad).filter((e) => Number.isFinite(e) && e > 0);
  const edadPromedio = edades.length > 0 ? edades.reduce((a, b) => a + b, 0) / edades.length : 0;

  const kpis = [
    buildKPI({
      id: 'total-beneficiarios',
      label: 'Beneficiarios',
      value: total,
      formatted: formatNumberAR(total),
      hint: 'Acumulado titular + suplente desde 2021.',
    }),
    buildKPI({
      id: 'pct-titulares',
      label: 'Titulares de adjudicación',
      value: pctTitulares,
      formatted: formatPercentAR(pctTitulares, 1),
      hint: `${formatNumberAR(titulares)} de ${formatNumberAR(total)} beneficiarios.`,
    }),
    buildKPI({
      id: 'pct-femenino',
      label: 'Titulares mujeres',
      value: pctFemenino,
      formatted: formatPercentAR(pctFemenino, 1),
      hint: `${formatNumberAR(femeninos)} de ${formatNumberAR(conGenero)} con género declarado.`,
    }),
    buildKPI({
      id: 'edad-promedio',
      label: 'Edad promedio del titular',
      value: Number(edadPromedio.toFixed(1)),
      formatted: edades.length > 0 ? `${edadPromedio.toFixed(1).replace('.', ',')}` : '—',
      unit: 'años',
    }),
  ];

  // ─── Charts ───

  // 1. Beneficiarios por año
  const porAnio = countBy(all, (r) => r.anio);
  const yearsSorted = [...porAnio.keys()].filter(Boolean).sort((a, b) => a - b);
  const anioData = yearsSorted.map((y) => ({ anio: String(y), beneficiarios: porAnio.get(y) || 0 }));

  // 2. Tipo sorteo (pie)
  const tipoCounts = countBy(
    all.filter((r) => r.tipoSorteo),
    (r) => r.tipoSorteo,
  );
  const tipoData = [...tipoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => ({ id: t, label: t, value: c }));

  // 3. Situación habitacional (pie)
  const sitCounts = countBy(
    all.filter((r) => r.situacion),
    (r) => r.situacion,
  );
  const sitData = [...sitCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s, c]) => ({ id: s, label: s, value: c }));

  // 4. Género (pie)
  const generoData = [
    { id: 'Femenino', label: 'Femenino', value: femeninos },
    { id: 'Masculino', label: 'Masculino', value: masculinos },
  ].filter((d) => d.value > 0);

  const charts = [
    {
      id: 'beneficiarios-anio',
      type: 'area',
      title: 'Beneficiarios incorporados por año',
      subtitle: 'Sorteos del programa Nuestro Terreno desde 2021.',
      data: anioData,
      config: { indexBy: 'anio', keys: ['beneficiarios'] },
    },
    ...(tipoData.length > 0
      ? [{
          id: 'tipo-sorteo',
          type: 'pie',
          title: 'Tipo de sorteo',
          subtitle: 'Familiar general, joven, otras categorías.',
          data: tipoData,
          config: {},
        }]
      : []),
    ...(sitData.length > 0
      ? [{
          id: 'situacion',
          type: 'pie',
          title: 'Situación habitacional al inscribirse',
          subtitle: 'Condición de vivienda al momento de la inscripción.',
          data: sitData,
          config: {},
        }]
      : []),
    ...(generoData.length > 0
      ? [{
          id: 'genero',
          type: 'pie',
          title: 'Género del titular inscripto',
          subtitle: 'Distribución entre titulares mujeres y varones.',
          data: generoData,
          config: {},
        }]
      : []),
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Programa Nuestro Terreno',
      category: 'vivienda-territorio',
      description:
        'Beneficiarios del programa Nuestro Terreno, mediante el cual el municipio adjudica lotes urbanos a familias de Venado Tuerto. Datos agregados de los sorteos realizados desde 2021.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    total,
    titulares,
    pctTitulares,
    pctFemenino,
    edadPromedio,
    yearsRange: yearsSorted.length > 0 ? `${yearsSorted[0]}–${yearsSorted[yearsSorted.length - 1]}` : '—',
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, titulares, pctTitulares, pctFemenino, edadPromedio, yearsRange }) {
  return `## Resumen

El programa **Nuestro Terreno** registró **${formatNumberAR(total)} beneficiarios** entre **${yearsRange}**, de los cuales **${formatNumberAR(titulares)}** (${formatPercentAR(pctTitulares, 1)}) son **titulares de adjudicación** y el resto, **suplentes** que ingresaron a la lista de espera. La edad promedio del titular al inscribirse es de **${edadPromedio.toFixed(1).replace('.', ',')} años**, y **${formatPercentAR(pctFemenino, 1)}** de los titulares con género declarado son mujeres.

## Cómo funciona el programa

**Nuestro Terreno** es un programa municipal por el que el municipio adjudica **lotes urbanos** a familias de Venado Tuerto en condición de obtener su primer terreno. La adjudicación se realiza por **sorteo público** entre los inscriptos que cumplen los requisitos: ser argentino o residente, no tener vivienda propia, residencia mínima en la ciudad, ingresos compatibles con la franja del programa y, en el caso del sorteo familiar, conformar un grupo familiar.

## Tipos de sorteo

- **Familiar - General:** para familias conformadas (con o sin hijos), sin distinción de edad.
- **Familiar - Joven:** dirigido a personas o familias jóvenes.
- **Otros:** sorteos especiales por categoría (madres solas, personas con discapacidad, fuerzas de seguridad, etc.).

## Situación habitacional al inscribirse

Las situaciones más frecuentes son: **propiedad compartida con familia u otros** (vivir con padres, suegros), **propiedad prestada o cedida**, **inquilinato** y **vivienda en condiciones precarias**. Esta variable es relevante para los criterios de adjudicación porque las situaciones más vulnerables suelen tener prioridad.

## Sobre los datos

Cada registro corresponde a un beneficiario del sorteo: identificador anónimo, condición (titular o suplente), tipo de sorteo, edad y género del titular al inscribirse, situación habitacional declarada y composición del grupo familiar (cantidad total, masculinos, femeninos). No incluye datos personales identificatorios ni la ubicación específica del lote adjudicado.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
