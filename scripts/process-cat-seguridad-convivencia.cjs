/**
 * Análisis ejecutivo de SEGURIDAD Y CONVIVENCIA.
 * Sintetiza: vehículos abandonados, licencias de conducir y decomisos de seguridad alimentaria.
 */

const {
  readCSV, parseSpanishNumber, extractYearFromPath, countBy, sumBy,
  writeJSON, writeMarkdown, loadManifest, findDataset, localPath,
  formatNumberAR, formatPercentAR, buildKPI, buildMeta,
} = require('./lib/csv-utils.cjs');

const SLUG = 'seguridad-convivencia';

function run() {
  console.log(`\n  → ${SLUG} (resumen ejecutivo)`);
  const m = loadManifest();
  const vehDs   = findDataset(m, 'vehiculos-abandonados');
  const licDs   = findDataset(m, 'licencias-de-conducir-2025');
  const decDs   = findDataset(m, 'decomisos-seguridad-alimentaria-2024');

  // ── Vehículos abandonados ──────────────────────────────
  const vehByYear = new Map();
  let vehTotal = 0;
  for (const res of vehDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    let yt = 0;
    for (const r of rows) {
      const ret = parseSpanishNumber(r.retiro) || 0;
      const fun = parseSpanishNumber(r.funcionamiento) || 0;
      const cor = parseSpanishNumber(r.corralon) || 0;
      yt += ret + fun + cor;
    }
    vehByYear.set(year, yt);
    vehTotal += yt;
  }
  const vehData = [...vehByYear.keys()].sort().map(y => ({
    anio: String(y), vehiculos: vehByYear.get(y) || 0,
  }));

  // ── Licencias de conducir ──────────────────────────────
  let licTotal = 0;
  let licMujeres = 0;
  const licClases = new Map();
  const licTipoTramite = new Map();
  for (const res of licDs.resources) {
    const rows = readCSV(localPath(res));
    licTotal += rows.length;
    for (const r of rows) {
      const g = String(r.genero || '').toUpperCase().trim();
      if (g === 'FEMENINO' || g === 'F') licMujeres += 1;
      // clases (pueden venir múltiples en una sola celda separadas por coma)
      const clases = String(r.clase || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const c of clases) licClases.set(c, (licClases.get(c) || 0) + 1);
      // tipo trámite
      const tt = String(r.tipo_tramite || '').trim().toUpperCase();
      if (tt) licTipoTramite.set(tt, (licTipoTramite.get(tt) || 0) + 1);
    }
  }
  const pctMujeresLic = licTotal > 0 ? (licMujeres / licTotal) * 100 : 0;

  const topClases = [...licClases.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([clase, n]) => ({ clase, licencias: n }));

  const tramiteData = [...licTipoTramite.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: id, value }));

  // ── Decomisos seguridad alimentaria ──────────────────
  let kgTotal = 0, lTotal = 0;
  for (const res of decDs.resources) {
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      kgTotal += parseSpanishNumber(r.kg_decomisados) || 0;
      lTotal += parseSpanishNumber(r.l_decomisados) || 0;
    }
  }

  // Mensual 2024 vs 2025 stacked
  const decMensual = new Map();
  for (const res of decDs.resources) {
    const yNum = extractYearFromPath(res.local_path);
    const year = yNum ? String(yNum) : 'Sin año';
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const mes = String(r.mes || '').toLowerCase().trim();
      if (!decMensual.has(mes)) decMensual.set(mes, { mes: capitalizeFirst(mes), '2024': 0, '2025': 0 });
      const kg = parseSpanishNumber(r.kg_decomisados) || 0;
      decMensual.get(mes)[year] += kg;
    }
  }
  const decData = [...decMensual.values()];

  // ── KPIs ───────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'veh-total',
      label: 'Vehículos abandonados intervenidos',
      value: vehTotal,
      formatted: formatNumberAR(vehTotal),
      hint: 'Retirados, regularizados o llevados al corralón (2021-2025)',
    }),
    buildKPI({
      id: 'licencias',
      label: 'Licencias de conducir 2025',
      value: licTotal,
      formatted: formatNumberAR(licTotal),
      hint: `${pctMujeresLic.toFixed(1).replace('.', ',')}% emitidas a mujeres`,
      status: 'good',
    }),
    buildKPI({
      id: 'kg-decomisados',
      label: 'Kg decomisados (2024-2025)',
      value: Math.round(kgTotal),
      formatted: formatNumberAR(kgTotal, 0),
      unit: 'kg',
      hint: `${formatNumberAR(lTotal, 0)} litros también decomisados`,
      status: 'warning',
    }),
  ];

  // ── Charts ───────────────────────────────────────────
  const charts = [
    {
      id: 'veh-yoy',
      type: 'bar',
      title: 'Vehículos abandonados intervenidos por año',
      subtitle: 'Suma de retiros, regularizaciones y traslados al corralón.',
      data: vehData,
      config: { indexBy: 'anio', keys: ['vehiculos'] },
    },
    {
      id: 'lic-clases',
      type: 'horizontalBar',
      title: 'Licencias de conducir 2025 · top clases',
      subtitle: 'Categorías más solicitadas (A: motos, B: autos, C/D: cargas y pasajeros).',
      data: topClases,
      config: { indexBy: 'clase', keys: ['licencias'] },
    },
    {
      id: 'lic-tramite',
      type: 'pie',
      title: 'Licencias por tipo de trámite',
      subtitle: 'Original vs renovación / duplicado.',
      data: tramiteData,
    },
    {
      id: 'dec-mes',
      type: 'stackedBar',
      title: 'Decomisos alimentarios por mes',
      subtitle: 'Kilos decomisados — 2024 vs 2025.',
      data: decData,
      config: { indexBy: 'mes', keys: ['2024', '2025'] },
    },
  ];

  // ── Output ────────────────────────────────────────────
  const data = {
    meta: buildMeta({
      id: SLUG,
      title: 'Seguridad y Convivencia · Resumen ejecutivo',
      category: SLUG,
      description:
        'Convivencia urbana, control vehicular y vigilancia sanitaria de alimentos.',
      manifestEntry: {
        source_url: 'https://datos-abiertos.venadotuerto.gob.ar/',
        license: 'CC-BY / ODC-BY',
        last_updated: licDs.last_updated,
        organization: 'Control Urbano y Convivencia',
        notes: '',
      },
    }),
    kpis, charts,
  };
  writeJSON(`public/data/${SLUG}/_resumen.json`, data);

  writeMarkdown(`public/reports/${SLUG}/_resumen.md`, renderMarkdown({
    vehTotal, licTotal, pctMujeresLic, kgTotal, lTotal,
  }));

  console.log(`    ✓ ${SLUG}/_resumen (${kpis.length} KPIs · ${charts.length} charts)`);
}

function capitalizeFirst(s) {
  if (!s) return s;
  return String(s)[0].toUpperCase() + String(s).slice(1);
}

function renderMarkdown(d) {
  return `## Convivencia urbana

Entre 2021 y 2025 se intervinieron **${formatNumberAR(d.vehTotal)} vehículos en situación de abandono**, ya sea retirados directamente, regularizados (puestos en funcionamiento por sus propietarios tras la notificación) o trasladados al corralón municipal. La política combina **acción coercitiva con etapas previas de intimación**, lo que reduce el costo del retiro forzoso.

## Movilidad y habilitación de conductores

En 2025 se emitieron **${formatNumberAR(d.licTotal)} licencias de conducir**, con una participación femenina del **${d.pctMujeresLic.toFixed(1).replace('.', ',')}%**. La distribución por clases muestra el peso del transporte de cargas y los vehículos profesionales, además del segmento masivo de licencias particulares (clase B) y motos (clase A).

## Vigilancia sanitaria

La Dirección de Seguridad Alimentaria decomisó **${formatNumberAR(Math.round(d.kgTotal))} kilos** y **${formatNumberAR(Math.round(d.lTotal))} litros** de alimentos en operativos durante 2024 y 2025. Esta actividad —generalmente invisible para el público— constituye **la principal barrera entre la cadena de comercialización y el consumidor final** ante productos vencidos, mal conservados o adulterados.

## Lectura

La política de convivencia descansa en tres pilares: ordenamiento del espacio público (vehículos), habilitación administrativa de conductas (licencias) y control sanitario (decomisos). Estos datasets miden actividad operativa; quedan fuera del alcance los datos de delitos —responsabilidad provincial— y la percepción ciudadana de seguridad.
`;
}

module.exports = run;
if (require.main === module) run();
