/**
 * Procesa el dataset "dependencias-desarrollo-humano".
 * - Lee 2 archivos: centros-de-salud.csv (12 filas) y centros-abordaje-creer.csv (8 filas).
 * - KPIs: total dependencias, centros-salud, espacios CREER, tipos de centro.
 * - Charts: pie tipo centro, bar centros por tipo.
 * - Tabla: directorio.
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
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'salud-desarrollo-humano/dependencias-desarrollo-humano';
const CKAN_ID = 'dependencias-desarrollo-humano';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const saludRes = ds.resources.find((r) => /centros-de-salud/i.test(r.local_path));
  const creerRes = ds.resources.find((r) => /creer/i.test(r.local_path));

  const centros = saludRes
    ? readCSV(localPath(saludRes)).map((r) => ({
        nombre: String(r.centro || '').trim(),
        direccion: String(r.direccion || '').trim(),
        telefono: String(r.telefono || '').trim(),
        email: String(r.email || '').trim(),
        tipo: String(r.tipo_centro || '').trim(),
        horarios: String(r.dias_y_horarios || '').trim(),
        tipoFuente: 'Centro de salud',
      })).filter((r) => r.nombre)
    : [];

  const creer = creerRes
    ? readCSV(localPath(creerRes)).map((r) => ({
        nombre: String(r.espacio || '').trim(),
        direccion: String(r.direccion || '').trim(),
        telefono: '',
        email: '',
        tipo: String(r.tipo || '').trim(),
        horarios: String(r.dias_y_horarios || '').trim(),
        tipoFuente: 'CREER',
      })).filter((r) => r.nombre)
    : [];

  console.log(`    centros-salud: ${centros.length}, CREER: ${creer.length}`);

  const todos = [...centros, ...creer];

  // ─── KPIs ───
  const total = todos.length;
  const tiposDistintos = new Set(todos.map((r) => r.tipo).filter(Boolean)).size;
  const espaciosCreerUnicos = new Set(creer.map((r) => r.nombre)).size;

  const kpis = [
    buildKPI({
      id: 'total-dependencias',
      label: 'Dependencias y servicios',
      value: total,
      formatted: formatNumberAR(total),
      hint: 'Centros de salud + espacios del programa CREER.',
    }),
    buildKPI({
      id: 'centros-salud',
      label: 'Centros de salud',
      value: centros.length,
      formatted: formatNumberAR(centros.length),
      hint: 'Atención primaria distribuida por barrios.',
    }),
    buildKPI({
      id: 'creer',
      label: 'Espacios CREER',
      value: espaciosCreerUnicos,
      formatted: formatNumberAR(espaciosCreerUnicos),
      hint: 'Centros del programa de abordaje territorial CREER.',
    }),
    buildKPI({
      id: 'tipos',
      label: 'Tipos de servicio',
      value: tiposDistintos,
      formatted: formatNumberAR(tiposDistintos),
      hint: 'Adultos, pediátrico, centros de escucha, etc.',
    }),
  ];

  // ─── Charts ───

  // 1. Centros de salud por tipo
  const tipoCentroCounts = countBy(
    centros.filter((c) => c.tipo),
    (c) => c.tipo,
  );
  const tipoCentroData = [...tipoCentroCounts.entries()]
    .map(([t, c]) => ({ id: t, label: t, value: c }));

  // 2. Espacios CREER por tipo
  const tipoCreerCounts = countBy(
    creer.filter((c) => c.tipo),
    (c) => c.tipo,
  );
  const tipoCreerData = [...tipoCreerCounts.entries()]
    .map(([t, c]) => ({ tipo: t.length > 28 ? t.slice(0, 26) + '…' : t, espacios: c }));

  const charts = [];

  if (tipoCentroData.length > 0) {
    charts.push({
      id: 'centros-por-tipo',
      type: 'pie',
      title: 'Centros de salud por tipo',
      subtitle: 'Distribución entre adultos, pediátrico y mixto.',
      data: tipoCentroData,
      config: {},
    });
  }

  if (tipoCreerData.length > 0) {
    charts.push({
      id: 'creer-por-tipo',
      type: 'bar',
      title: 'Espacios CREER por tipo de actividad',
      subtitle: 'Centros de escucha, talleres, abordajes territoriales.',
      data: tipoCreerData,
      config: { indexBy: 'tipo', keys: ['espacios'] },
    });
  }

  // ─── Tabla: directorio ───
  const tableRows = todos
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((r) => [
      r.nombre,
      r.tipo || '—',
      r.direccion || '—',
      r.telefono || '—',
    ]);

  const tables = [
    {
      id: 'directorio',
      title: 'Directorio de dependencias',
      columns: ['Nombre', 'Tipo', 'Dirección', 'Teléfono'],
      rows: tableRows,
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Dependencias de Desarrollo Humano',
      category: 'salud-desarrollo-humano',
      description:
        'Red de centros de salud y espacios del programa CREER que dependen de la Secretaría de Desarrollo Humano: ubicación, días, horarios y tipos de servicio.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    total,
    centrosSalud: centros.length,
    espaciosCreerUnicos,
    tiposDistintos,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function renderMarkdown({ total, centrosSalud, espaciosCreerUnicos, tiposDistintos }) {
  return `## Resumen

La Secretaría de Desarrollo Humano cuenta con **${formatNumberAR(centrosSalud)} centros de salud** y **${formatNumberAR(espaciosCreerUnicos)} espacios** del programa CREER, sumando **${formatNumberAR(total)} dependencias y puntos de atención** distribuidos en la ciudad.

## Centros de salud

Los **centros de salud** brindan atención primaria barrial y se diferencian por tipo: **adultos**, **pediátrico** y **mixto**. La red municipal complementa la oferta provincial (Hospital Gutiérrez) con presencia barrial cercana, accesible y de baja complejidad. Los días y horarios varían: algunos abren todos los días, otros lunes a viernes en franjas matutinas o extendidas.

## Programa CREER

El programa **CREER** ("Centros de Abordaje Territorial") opera espacios de **escucha, talleres y abordajes** en distintos puntos de la ciudad, con foco en grupos vulnerables (jóvenes, adultos mayores, personas con consumo problemático). Cada espacio funciona en horarios específicos durante la semana.

## Diversidad de servicios

Los **${formatNumberAR(tiposDistintos)} tipos** de servicio reflejan la lógica de abordaje integral del desarrollo humano: salud primaria, escucha activa, acompañamiento territorial, capacitación y articulación con organizaciones barriales.

## Sobre los datos

El registro combina dos fuentes: el listado de centros de salud (con nombre, dirección, teléfono, email, tipo y horarios) y el listado de espacios CREER (con tipo de actividad, espacio físico, dirección y horarios). Algunos espacios CREER aparecen varias veces si tienen actividades en distintos días.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
