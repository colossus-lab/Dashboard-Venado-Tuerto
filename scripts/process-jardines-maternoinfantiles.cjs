/**
 * Procesa el dataset "asistentes-jardines-materno-infantiles-municipales-2025".
 * - Lee 1 archivo: 378 asistentes (jardin, direccion_jardin, turno, genero, sala).
 * - KPIs: total asistentes, jardines, % mañana, % género.
 * - Charts: bar por jardín, pie turno, pie género.
 * - Tabla: jardines con dirección.
 */

const {
  readCSV,
  countBy,
  groupBy,
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

const REPORT_ID = 'educacion/jardines-maternoinfantiles';
const CKAN_ID = 'asistentes-jardines-materno-infantiles-municipales-2025';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const rows = readCSV(localPath(ds.resources[0])).map((r) => ({
    jardin: String(r.jardin || '').trim(),
    direccion: String(r.direccion_jardin || '').trim(),
    turno: String(r.turno || '').trim(),
    genero: String(r.genero || '').trim(),
    sala: String(r.sala || '').trim(),
  })).filter((r) => r.jardin);

  console.log(`    rows: ${rows.length}`);

  // ─── KPIs ───
  const total = rows.length;
  const jardinesDistintos = new Set(rows.map((r) => r.jardin)).size;

  const turnoCounts = countBy(
    rows.filter((r) => r.turno),
    (r) => r.turno,
  );
  const manana = turnoCounts.get('Mañana') || 0;
  const tarde = turnoCounts.get('Tarde') || 0;
  const conTurno = manana + tarde;
  const pctManana = conTurno > 0 ? (manana / conTurno) * 100 : 0;

  const generoCounts = countBy(
    rows.filter((r) => r.genero),
    (r) => r.genero,
  );
  const masculino = generoCounts.get('Masculino') || 0;
  const femenino = generoCounts.get('Femenino') || 0;
  const conGenero = masculino + femenino;
  const pctMasculino = conGenero > 0 ? (masculino / conGenero) * 100 : 0;

  const kpis = [
    buildKPI({
      id: 'total-asistentes',
      label: 'Asistentes totales',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'niños/as',
    }),
    buildKPI({
      id: 'jardines',
      label: 'Jardines municipales',
      value: jardinesDistintos,
      formatted: formatNumberAR(jardinesDistintos),
      hint: 'Establecimientos materno-infantiles del municipio.',
    }),
    buildKPI({
      id: 'pct-manana',
      label: 'Turno mañana',
      value: pctManana,
      formatted: formatPercentAR(pctManana, 1),
      hint: `${formatNumberAR(manana)} de ${formatNumberAR(conTurno)} asistentes con turno declarado.`,
    }),
    buildKPI({
      id: 'pct-masculino',
      label: 'Asistentes varones',
      value: pctMasculino,
      formatted: formatPercentAR(pctMasculino, 1),
      hint: `${formatNumberAR(masculino)} de ${formatNumberAR(conGenero)} con género declarado.`,
    }),
  ];

  // ─── Charts ───

  // 1. Por jardín
  const jardinCounts = countBy(rows, (r) => r.jardin);
  const jardinData = [...jardinCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([j, c]) => ({
      jardin: j.length > 28 ? j.slice(0, 26) + '…' : j,
      asistentes: c,
    }));

  // 2. Turno (pie)
  const turnoData = [...turnoCounts.entries()]
    .map(([t, c]) => ({ id: t, label: t, value: c }))
    .filter((d) => d.value > 0);

  // 3. Género (pie)
  const generoData = [
    { id: 'Femenino', label: 'Femenino', value: femenino },
    { id: 'Masculino', label: 'Masculino', value: masculino },
  ].filter((d) => d.value > 0);

  const charts = [
    {
      id: 'por-jardin',
      type: 'horizontalBar',
      title: 'Asistentes por jardín',
      subtitle: 'Cantidad de niños y niñas en cada establecimiento.',
      data: jardinData,
      config: { indexBy: 'jardin', keys: ['asistentes'] },
    },
    {
      id: 'turno',
      type: 'pie',
      title: 'Distribución por turno',
      subtitle: 'Mañana vs. tarde.',
      data: turnoData,
      config: {},
    },
    {
      id: 'genero',
      type: 'pie',
      title: 'Distribución por género',
      subtitle: 'Asistentes por género autoinformado.',
      data: generoData,
      config: {},
    },
  ];

  // ─── Tabla: directorio jardines ───
  const grouped = groupBy(rows, (r) => r.jardin);
  const tableRows = [...grouped.entries()]
    .map(([jardin, items]) => [
      jardin,
      items[0].direccion || '—',
      formatNumberAR(items.length),
    ])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const tables = [
    {
      id: 'jardines',
      title: 'Directorio de jardines materno-infantiles',
      columns: ['Jardín', 'Dirección', 'Asistentes'],
      rows: tableRows,
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Jardines Materno-Infantiles',
      category: 'educacion',
      description:
        'Asistentes a los jardines materno-infantiles municipales de Venado Tuerto: distribución por jardín, turno, sala y género. Indicador de la cobertura de cuidados en la primera infancia.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ total, jardinesDistintos, pctManana, pctMasculino });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function renderMarkdown({ total, jardinesDistintos, pctManana, pctMasculino }) {
  return `## Resumen

Los jardines materno-infantiles municipales de Venado Tuerto reciben a **${formatNumberAR(total)} niños y niñas** distribuidos en **${formatNumberAR(jardinesDistintos)} establecimientos**. **${formatPercentAR(pctManana, 1)}** asisten al turno mañana y el resto, al de la tarde.

## Composición por género

**${formatPercentAR(pctMasculino, 1)}** de los asistentes son varones, según el género autoinformado al momento de la inscripción. La distribución es esperablemente cercana al 50/50, reflejando la composición demográfica de la primera infancia.

## Rol del municipio en la primera infancia

Los jardines materno-infantiles municipales complementan la oferta provincial (jardines de infantes) brindando cuidado y estimulación temprana a niños desde los 45 días hasta los 3 años. Son una herramienta clave de conciliación familia-trabajo, sobre todo para hogares de menores ingresos donde el cuidado privado resulta inaccesible.

## Cobertura territorial

Los jardines se distribuyen estratégicamente en distintos barrios para maximizar la cercanía con las familias usuarias. La elección de turno mañana o tarde depende de la sala del niño, la organización del jardín y la disponibilidad de los responsables familiares.

## Sobre los datos

Cada registro identifica al jardín, la dirección, el turno (mañana/tarde), la sala (1, 2 o 3, según edad) y el género del asistente. No contiene datos personales identificatorios.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
