/**
 * Análisis ejecutivo de AMBIENTE.
 * Sintetiza: actividades Reciclar Venado y visitas a la Planta de Tratamiento de RSU.
 */

const {
  readCSV, parseSpanishNumber, countBy, sumBy,
  writeJSON, writeMarkdown, loadManifest, findDataset, localPath,
  formatNumberAR, buildKPI, buildMeta,
} = require('./lib/csv-utils.cjs');

const SLUG = 'ambiente';

function run() {
  console.log(`\n  → ${SLUG} (resumen ejecutivo)`);
  const m = loadManifest();
  const recDs = findDataset(m, 'actividades-reciclar-venado-2025');
  const planDs = findDataset(m, 'visitas-a-la-planta-de-tratamiento-de-residuos-solidos-urbanos-2025');

  // ── Reciclar Venado ────────────────────────────────────
  const recRows = readCSV(localPath(recDs.resources[0]));
  const totalActividades = recRows.length;
  const totalAsistRec = sumBy(recRows, r => parseSpanishNumber(r.cantidad_asistentes));
  const tipoReceptor = countBy(recRows, r => String(r.tipo_receptor || '(sin)').trim());
  const rangoEtario = countBy(recRows, r => String(r.rango_etario || '(sin)').trim());
  const tipoActividad = countBy(recRows, r => String(r.actividad || '(sin)').trim());

  // ── Visitas a la planta de tratamiento ──────────────
  const planRows = readCSV(localPath(planDs.resources[0]));
  const totalVisitas = planRows.length;
  const totalAlumnos = sumBy(planRows, r => parseSpanishNumber(r.cantidad_alumnos));
  const turnos = countBy(planRows, r => String(r.turno || '(sin)').trim());
  const escuelas = new Set(planRows.map(r => String(r['escuela_institución'] || '').trim())).size;

  // ── KPIs ───────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'actividades',
      label: 'Actividades de educación ambiental',
      value: totalActividades,
      formatted: formatNumberAR(totalActividades),
      hint: `${formatNumberAR(totalAsistRec)} asistentes en 2025`,
      status: 'good',
    }),
    buildKPI({
      id: 'asistentes-rec',
      label: 'Asistentes a actividades',
      value: totalAsistRec,
      formatted: formatNumberAR(totalAsistRec),
      hint: 'Niños, jóvenes y adultos sumados',
    }),
    buildKPI({
      id: 'visitas-planta',
      label: 'Visitas a la planta de tratamiento',
      value: totalVisitas,
      formatted: formatNumberAR(totalVisitas),
      hint: `${formatNumberAR(totalAlumnos)} alumnos · ${escuelas} escuelas`,
    }),
  ];

  // ── Charts ────────────────────────────────────────────
  const tipoReceptorData = [...tipoReceptor.entries()]
    .filter(([k]) => k && k !== '(sin)')
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: id, value }));

  const rangoEtarioData = [...rangoEtario.entries()]
    .filter(([k]) => k && k !== '(sin)')
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: id, value }));

  const tipoActivData = [...tipoActividad.entries()]
    .filter(([k]) => k && k !== '(sin)')
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([tipo, n]) => ({ tipo, total: n }));

  const turnosData = [...turnos.entries()]
    .filter(([k]) => k && k !== '(sin)')
    .map(([id, value]) => ({ id, label: id, value }));

  const charts = [
    {
      id: 'tipo-receptor',
      type: 'pie',
      title: 'Actividades de Reciclar Venado · público objetivo',
      subtitle: 'Empresas, escuelas, ONG y otros destinatarios.',
      data: tipoReceptorData,
    },
    {
      id: 'rango-etario',
      type: 'pie',
      title: 'Asistentes por rango etario',
      subtitle: 'Composición demográfica de las actividades.',
      data: rangoEtarioData,
    },
    {
      id: 'tipo-activ',
      type: 'horizontalBar',
      title: 'Top actividades realizadas',
      subtitle: 'Capacitaciones, charlas, talleres y otras intervenciones.',
      data: tipoActivData,
      config: { indexBy: 'tipo', keys: ['total'] },
    },
    {
      id: 'visitas-turno',
      type: 'pie',
      title: 'Visitas escolares · turno',
      subtitle: 'Distribución mañana / tarde de las visitas a la planta.',
      data: turnosData,
    },
  ];

  // ── Output ────────────────────────────────────────────
  const data = {
    meta: buildMeta({
      id: SLUG,
      title: 'Ambiente · Resumen ejecutivo',
      category: SLUG,
      description:
        'Programas de educación ambiental y gestión de residuos sólidos urbanos.',
      manifestEntry: {
        source_url: 'https://datos-abiertos.venadotuerto.gob.ar/',
        license: 'CC-BY / ODC-BY',
        last_updated: recDs.last_updated,
        organization: 'Intendencia · Participación Ambiental',
        notes: '',
      },
    }),
    kpis, charts,
  };
  writeJSON(`public/data/${SLUG}/_resumen.json`, data);

  writeMarkdown(`public/reports/${SLUG}/_resumen.md`, renderMarkdown({
    totalActividades, totalAsistRec, totalVisitas, totalAlumnos, escuelas,
  }));

  console.log(`    ✓ ${SLUG}/_resumen (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown(d) {
  return `## Educación ambiental territorial

El programa **Reciclar Venado**, dependiente de la Dirección de Participación Ambiental, realizó **${formatNumberAR(d.totalActividades)} actividades en 2025** —capacitaciones, charlas, talleres y eventos— con un alcance de **${formatNumberAR(d.totalAsistRec)} personas**. Las intervenciones se distribuyen entre escuelas, empresas, organizaciones civiles y barrios, con foco en separación en origen, compostaje y consumo responsable.

## Visitas a la planta de tratamiento de RSU

La Planta de Tratamiento de Residuos Sólidos Urbanos recibió **${formatNumberAR(d.totalVisitas)} visitas escolares** en 2025, sumando **${formatNumberAR(d.totalAlumnos)} alumnos de ${d.escuelas} escuelas e instituciones**. Estas visitas convierten la infraestructura ambiental en **espacio pedagógico**, mostrando in situ qué pasa con los residuos después de salir del hogar.

## Lectura

La estrategia ambiental del municipio combina **acción territorial** (Reciclar Venado en empresas, escuelas y barrios) con **transparencia operativa** (las visitas a planta son una forma de rendición de cuentas pedagógica). Los datasets miden actividad educativa; falta información sobre toneladas tratadas, tasa de recuperación y composición de residuos —dimensiones críticas para la política de gestión integral.
`;
}

module.exports = run;
if (require.main === module) run();
