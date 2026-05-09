/**
 * Procesa el dataset "organigrama" del portal CKAN de Venado Tuerto.
 * - Lee 1 archivo: estructura organizacional municipal con cargos políticos.
 * - Calcula KPIs (total cargos, vacantes, % género femenino, secretarías).
 * - Charts: cargos por secretaría, distribución por función, género.
 * - Genera tabla: directorio por secretaría.
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

const REPORT_ID = 'gobierno/organigrama';
const CKAN_ID = 'organigrama';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => ({
    funcion: String(r['Función'] || '').trim(),
    secretaria: String(r['Secretaría'] || '').trim(),
    subsecretaria: String(r['Subsecretaría'] || '').trim(),
    direccion: String(r['Dirección'] || '').trim(),
    coordinacion: String(r['Coordinación'] || '').trim(),
    funcionario: String(r['Funcionario'] || '').trim(),
    genero: String(r['Género'] || '').trim(),
  }));

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const total = rows.length;
  const vacantes = rows.filter((r) => !r.funcionario || r.funcionario === '-').length;
  const ocupados = rows.filter((r) => r.funcionario && r.funcionario !== '-');
  const femeninos = ocupados.filter((r) => r.genero === 'Femenino').length;
  const masculinos = ocupados.filter((r) => r.genero === 'Masculino').length;
  const pctFemenino = ocupados.length > 0 ? (femeninos / ocupados.length) * 100 : 0;
  const secretarias = new Set(rows.map((r) => r.secretaria).filter((s) => s && s !== '-')).size;

  const kpis = [
    buildKPI({
      id: 'total-cargos',
      label: 'Cargos en el organigrama',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'cargos',
    }),
    buildKPI({
      id: 'secretarias',
      label: 'Secretarías',
      value: secretarias,
      formatted: formatNumberAR(secretarias),
      hint: 'Áreas de primera línea bajo el Intendente',
    }),
    buildKPI({
      id: 'pct-femenino',
      label: 'Funcionarias mujeres',
      value: pctFemenino,
      formatted: formatPercentAR(pctFemenino, 1),
      hint: `${formatNumberAR(femeninos)} de ${formatNumberAR(ocupados.length)} cargos ocupados`,
    }),
    buildKPI({
      id: 'vacantes',
      label: 'Cargos vacantes',
      value: vacantes,
      formatted: formatNumberAR(vacantes),
      hint: 'Sin funcionario designado en el momento del relevamiento',
      status: vacantes > 0 ? 'warning' : 'good',
    }),
  ];

  // ─── Charts ───

  // 1. Cargos por secretaría
  const secCounts = countBy(
    rows.filter((r) => r.secretaria && r.secretaria !== '-'),
    (r) => r.secretaria,
  );
  const secData = [...secCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sec, count]) => ({
      secretaria: sec.length > 32 ? sec.slice(0, 30) + '…' : sec,
      cargos: count,
    }));

  // 2. Distribución por función
  const funcCounts = countBy(
    rows.filter((r) => r.funcion && r.funcion !== '-'),
    (r) => r.funcion,
  );
  const funcData = [...funcCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([fn, count]) => ({ id: fn, label: fn, value: count }));

  // 3. Género (solo cargos ocupados)
  const generoData = [
    { id: 'Femenino', label: 'Femenino', value: femeninos },
    { id: 'Masculino', label: 'Masculino', value: masculinos },
  ].filter((d) => d.value > 0);

  const charts = [
    {
      id: 'cargos-por-secretaria',
      type: 'horizontalBar',
      title: 'Cargos por secretaría',
      subtitle: 'Cantidad de funciones jerárquicas que dependen de cada secretaría.',
      data: secData,
      config: { indexBy: 'secretaria', keys: ['cargos'] },
    },
    {
      id: 'distribucion-funcion',
      type: 'pie',
      title: 'Distribución por nivel jerárquico',
      subtitle: 'Tipos de cargo en la estructura municipal.',
      data: funcData,
      config: {},
    },
  ];

  if (generoData.length > 0) {
    charts.push({
      id: 'genero',
      type: 'pie',
      title: 'Funcionarios por género',
      subtitle: 'Participación femenina y masculina en cargos ocupados.',
      data: generoData,
      config: {},
    });
  }

  // ─── Tabla: Directorio por secretaría ───
  const tableRows = [...secCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sec, count]) => [sec, formatNumberAR(count)]);

  const tables = [
    {
      id: 'secretarias',
      title: 'Cantidad de cargos por secretaría',
      columns: ['Secretaría', 'Cargos'],
      rows: tableRows,
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Organigrama Municipal',
      category: 'gobierno',
      description:
        'Estructura organizacional política del Municipio de Venado Tuerto: secretarías, subsecretarías, direcciones y coordinaciones, con sus titulares actuales y normativa de creación.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ total, secretarias, vacantes, pctFemenino, femeninos, ocupados: ocupados.length });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function renderMarkdown({ total, secretarias, vacantes, pctFemenino, femeninos, ocupados }) {
  return `## Resumen

El organigrama del Municipio de Venado Tuerto cuenta con **${formatNumberAR(total)} cargos jerárquicos** distribuidos en **${formatNumberAR(secretarias)} secretarías** de primera línea. Cada secretaría agrupa subsecretarías, direcciones y coordinaciones, conformando la estructura política del Departamento Ejecutivo.

## Composición por género

De los **${formatNumberAR(ocupados)} cargos ocupados**, **${formatNumberAR(femeninos)}** corresponden a funcionarias mujeres (${formatPercentAR(pctFemenino, 1)} del total). El resto corresponde a funcionarios varones. Esta paridad es uno de los indicadores transversales de la gestión municipal.

## Cargos vacantes

${
  vacantes > 0
    ? `Al momento del relevamiento, **${formatNumberAR(vacantes)} cargos** figuran sin funcionario designado. Las vacantes pueden corresponder a posiciones en revisión, transiciones de gestión o áreas en reestructuración.`
    : `Todos los cargos del organigrama tienen funcionario designado.`
}

## Marco normativo

La estructura del organigrama está definida por la **Ordenanza Nº 5745/23** del Concejo Municipal. Cada designación particular se formaliza por decreto del Departamento Ejecutivo, con publicación en el Boletín Oficial municipal.

## Sobre los datos

El dataset incluye, para cada cargo, la función (Secretario, Subsecretario, Director, Coordinador), el área de pertenencia, el nombre del funcionario, el género autoinformado, y los enlaces a la ordenanza de creación y al decreto de designación.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
