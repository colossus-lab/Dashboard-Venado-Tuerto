/**
 * Análisis ejecutivo de SALUD Y DESARROLLO HUMANO.
 * Sintetiza: dependencias DH (centros de salud + abordaje CREER) y carnets manipulación.
 */

const {
  readCSV, parseSpanishNumber, sumBy,
  writeJSON, writeMarkdown, loadManifest, findDataset, localPath,
  formatNumberAR, buildKPI, buildMeta,
} = require('./lib/csv-utils.cjs');

const SLUG = 'salud-desarrollo-humano';

function run() {
  console.log(`\n  → ${SLUG} (resumen ejecutivo)`);
  const m = loadManifest();
  const depDs = findDataset(m, 'dependencias-desarrollo-humano');
  const carnDs = findDataset(m, 'carnets-de-manipulacion-de-alimentos-2025');

  // ── Centros de salud + abordaje CREER ──────────────────────
  const centrosRes = depDs.resources.find(r => /centros-de-salud/i.test(r.local_path));
  const creerRes  = depDs.resources.find(r => /abordaje-creer/i.test(r.local_path));
  const centros = centrosRes ? readCSV(localPath(centrosRes)) : [];
  const creer = creerRes ? readCSV(localPath(creerRes)) : [];

  const totalCentros = centros.length;
  const totalCreer = creer.length;

  // Tipo de centro de salud
  const tipoCentros = {};
  for (const c of centros) {
    const t = String(c.tipo_centro || '(sin)').trim();
    tipoCentros[t] = (tipoCentros[t] || 0) + 1;
  }
  const tipoCentrosData = Object.entries(tipoCentros)
    .filter(([k]) => k && k !== '(sin)')
    .map(([id, value]) => ({ id, label: id, value }));

  // Tipo de espacio CREER
  const tipoCreer = {};
  for (const c of creer) {
    const t = String(c.tipo || '(sin)').trim();
    tipoCreer[t] = (tipoCreer[t] || 0) + 1;
  }
  const tipoCreerData = Object.entries(tipoCreer)
    .filter(([k]) => k && k !== '(sin)')
    .map(([tipo, n]) => ({ tipo, espacios: n }));

  // ── Carnets manipulación ────────────────────────────────
  const carnRows = readCSV(localPath(carnDs.resources[0]));
  let totalCarnets = 0;
  const carnetsMensuales = [];
  for (const r of carnRows) {
    const n = parseSpanishNumber(r.carnets);
    if (Number.isFinite(n)) {
      totalCarnets += n;
      carnetsMensuales.push({ mes: String(r.mes).trim(), carnets: n });
    }
  }
  // Ordenar por mes
  carnetsMensuales.sort((a, b) => a.mes.localeCompare(b.mes));

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'centros',
      label: 'Centros de salud municipales',
      value: totalCentros,
      formatted: formatNumberAR(totalCentros),
      hint: 'Atención primaria distribuida en barrios',
      status: 'good',
    }),
    buildKPI({
      id: 'creer',
      label: 'Espacios Abordaje CREER',
      value: totalCreer,
      formatted: formatNumberAR(totalCreer),
      hint: 'Centros de escucha y acompañamiento social',
    }),
    buildKPI({
      id: 'carnets-2025',
      label: 'Carnets manipulación 2025',
      value: totalCarnets,
      formatted: formatNumberAR(totalCarnets),
      hint: 'Emitidos por Seguridad Alimentaria',
    }),
  ];

  // ── Tablas de centros ──────────────────────────────────────
  const tablaCentros = {
    id: 'tabla-centros',
    title: 'Centros de salud · directorio',
    columns: ['Centro', 'Dirección', 'Tipo', 'Días y horarios'],
    rows: centros.map(c => [
      String(c.centro || '').trim(),
      String(c.direccion || '').trim(),
      String(c.tipo_centro || '').trim(),
      String(c.dias_y_horarios || '').trim(),
    ]),
    maxRows: 30,
  };

  const tablaCreer = {
    id: 'tabla-creer',
    title: 'Espacios CREER · puntos de atención',
    columns: ['Espacio', 'Tipo', 'Dirección', 'Días y horarios'],
    rows: creer.map(c => [
      String(c.espacio || '').trim(),
      String(c.tipo || '').trim(),
      String(c.direccion || '').trim(),
      String(c.dias_y_horarios || '').trim(),
    ]),
    maxRows: 30,
  };

  // ── Charts ────────────────────────────────────────────────
  const charts = [];
  if (tipoCentrosData.length > 0) {
    charts.push({
      id: 'centros-tipo',
      type: 'pie',
      title: 'Centros de salud por tipo',
      subtitle: 'Especialización del primer nivel de atención.',
      data: tipoCentrosData,
    });
  }
  if (tipoCreerData.length > 0) {
    charts.push({
      id: 'creer-tipo',
      type: 'horizontalBar',
      title: 'Espacios CREER · tipo de dispositivo',
      subtitle: 'Centros de escucha, acompañamiento y atención psicosocial.',
      data: tipoCreerData,
      config: { indexBy: 'tipo', keys: ['espacios'] },
    });
  }
  if (carnetsMensuales.length > 0) {
    charts.push({
      id: 'carnets-mes',
      type: 'bar',
      title: 'Carnets de manipulación emitidos por mes',
      subtitle: 'Trámite obligatorio para personal gastronómico (2025).',
      data: carnetsMensuales,
      config: { indexBy: 'mes', keys: ['carnets'] },
    });
  }

  // ── Output ────────────────────────────────────────────────
  const data = {
    meta: buildMeta({
      id: SLUG,
      title: 'Salud y Desarrollo Humano · Resumen ejecutivo',
      category: SLUG,
      description:
        'Atención primaria de salud, dispositivos de acompañamiento social y control sanitario alimentario.',
      manifestEntry: {
        source_url: 'https://datos-abiertos.venadotuerto.gob.ar/',
        license: 'CC-BY / ODC-BY',
        last_updated: depDs.last_updated,
        organization: 'Desarrollo Humano · Control Urbano',
        notes: '',
      },
    }),
    kpis, charts, tables: [tablaCentros, tablaCreer],
  };
  writeJSON(`public/data/${SLUG}/_resumen.json`, data);

  writeMarkdown(`public/reports/${SLUG}/_resumen.md`, renderMarkdown({
    totalCentros, totalCreer, totalCarnets,
  }));

  console.log(`    ✓ ${SLUG}/_resumen (${kpis.length} KPIs · ${charts.length} charts · 2 tablas)`);
}

function renderMarkdown(d) {
  return `## Atención primaria de salud

La red municipal cuenta con **${formatNumberAR(d.totalCentros)} centros de atención primaria** distribuidos en distintos barrios. Combinan turnos para adultos, atención pediátrica y centros integradores comunitarios (CIC), conformando la **primera línea del sistema sanitario local**, complementaria a los hospitales provinciales.

## Acompañamiento social y comunitario

El programa **Abordaje CREER** despliega **${formatNumberAR(d.totalCreer)} espacios** de escucha, acompañamiento psicosocial y centros de día en distintos puntos de la ciudad. Estos dispositivos atienden situaciones de vulnerabilidad, salud mental y consumo problemático con un enfoque territorial y de cercanía.

## Control sanitario alimentario

En 2025 se emitieron **${formatNumberAR(d.totalCarnets)} carnets de manipulación de alimentos** por la Dirección de Seguridad Alimentaria. Este trámite obligatorio para personal gastronómico es una herramienta clave para la **prevención de enfermedades transmitidas por alimentos** y un indicador del dinamismo del rubro en la ciudad.

## Lectura

La política sanitaria y social municipal combina infraestructura (centros físicos), programas territoriales (CREER) y vigilancia epidemiológica (control alimentario). Estos datasets reflejan el lado de la **oferta**; un análisis integral requeriría datos sobre demanda, tiempos de espera y resultados sanitarios.
`;
}

module.exports = run;
if (require.main === module) run();
