/**
 * Análisis ejecutivo de OBRAS Y SERVICIOS PÚBLICOS.
 * Sintetiza: pavimentos/cordón cuneta, fábrica de tubos y ladrillos, mensuras,
 * ingreso de planos y transporte urbano de pasajeros (TUP).
 */

const {
  readCSV, parseSpanishNumber, parseDDMMYYYY, extractYearFromPath, countBy, sumBy,
  writeJSON, writeMarkdown, loadManifest, findDataset, localPath,
  formatNumberAR, buildKPI, buildMeta,
} = require('./lib/csv-utils.cjs');

const SLUG = 'obras-servicios';

function run() {
  console.log(`\n  → ${SLUG} (resumen ejecutivo)`);
  const m = loadManifest();
  const obrDs    = findDataset(m, 'obras-de-pavimento-cordon-cuneta-y-otros-2020');
  const fabDs    = findDataset(m, 'fabricacion-municipal-de-tubos-y-ladrillos-2020');
  const menDs    = findDataset(m, 'mensuras');
  const planDs   = findDataset(m, 'ingreso-de-planos-2020');
  const tupDs    = findDataset(m, 'viajes-y-kilometros-recorridos-tup');

  // ── Obras de pavimento ──────────────────────────────────────
  const obrasByYear = new Map();
  const obrasPorTipo = new Map();
  const obrasPorBarrio = new Map();
  for (const res of obrDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    obrasByYear.set(year, rows.length);
    for (const r of rows) {
      const tipo = String(r.tipo_obra || '').trim() || 'Sin tipo';
      obrasPorTipo.set(tipo, (obrasPorTipo.get(tipo) || 0) + 1);
      const barrio = String(r.barrio || '').trim() || 'Sin barrio';
      obrasPorBarrio.set(barrio, (obrasPorBarrio.get(barrio) || 0) + 1);
    }
  }
  const obrasTotal = [...obrasByYear.values()].reduce((a, b) => a + b, 0);

  // ── Fábrica municipal de tubos ──────────────────────────
  const fabByYear = new Map();
  for (const res of fabDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    let totalTubos = 0;
    let totalBlocks = 0;
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (/^caño_/i.test(k)) totalTubos += parseSpanishNumber(r[k]) || 0;
        if (/^block_/i.test(k)) totalBlocks += parseSpanishNumber(r[k]) || 0;
      }
    }
    fabByYear.set(year, { tubos: totalTubos, blocks: totalBlocks });
  }
  const fabData = [...fabByYear.keys()].sort().map(y => ({
    anio: String(y),
    tubos: fabByYear.get(y).tubos,
    bloques: fabByYear.get(y).blocks,
  }));
  const totalTubos = sumBy([...fabByYear.values()], v => v.tubos);
  const totalBloques = sumBy([...fabByYear.values()], v => v.blocks);

  // ── Mensuras y planos ──────────────────────────────────
  const menByYear = new Map();
  for (const res of menDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    menByYear.set(year, rows.length);
  }
  const totalMensuras = [...menByYear.values()].reduce((a, b) => a + b, 0);

  const planosByYear = new Map();
  let totalSuperficie = 0;
  for (const res of planDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    planosByYear.set(year, rows.length);
    for (const r of rows) {
      totalSuperficie += parseSpanishNumber(r.superficie_en_m2) || 0;
    }
  }
  const totalPlanos = [...planosByYear.values()].reduce((a, b) => a + b, 0);

  // ── Transporte (TUP) ───────────────────────────────────
  const tupByYear = new Map();
  let totalViajes = 0;
  let totalKm = 0;
  for (const res of tupDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    let viajes = 0, km = 0;
    for (const r of rows) {
      viajes += parseSpanishNumber(r.cantidad_viajes) || 0;
      km += parseSpanishNumber(r.km_totales) || 0;
    }
    tupByYear.set(year, { viajes, km });
    totalViajes += viajes;
    totalKm += km;
  }
  const tupData = [...tupByYear.keys()].sort().map(y => ({
    anio: String(y),
    viajes: tupByYear.get(y).viajes,
    km: tupByYear.get(y).km,
  }));

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'obras-total',
      label: 'Obras públicas ejecutadas',
      value: obrasTotal,
      formatted: formatNumberAR(obrasTotal),
      hint: 'Pavimento, cordón cuneta y otros (2020-2025)',
      status: 'good',
    }),
    buildKPI({
      id: 'fabrica',
      label: 'Producción municipal',
      value: totalTubos + totalBloques,
      formatted: formatNumberAR(totalTubos + totalBloques),
      hint: `${formatNumberAR(totalTubos)} tubos · ${formatNumberAR(totalBloques)} bloques`,
    }),
    buildKPI({
      id: 'planos',
      label: 'Planos presentados',
      value: totalPlanos,
      formatted: formatNumberAR(totalPlanos),
      hint: `${formatNumberAR(Math.round(totalSuperficie))} m² regularizados`,
    }),
    buildKPI({
      id: 'mensuras',
      label: 'Expedientes de mensura',
      value: totalMensuras,
      formatted: formatNumberAR(totalMensuras),
      hint: 'Cambios catastrales (2020-2025)',
    }),
    buildKPI({
      id: 'tup-viajes',
      label: 'Viajes TUP acumulados',
      value: totalViajes,
      formatted: formatNumberAR(totalViajes),
      hint: `${formatNumberAR(Math.round(totalKm / 1000))} mil km recorridos`,
    }),
  ];

  // ── Charts ────────────────────────────────────────────
  const obrasYearData = [...obrasByYear.keys()].sort().map(y => ({
    anio: String(y), obras: obrasByYear.get(y) || 0,
  }));
  const tipoObrasData = [...obrasPorTipo.entries()]
    .filter(([k]) => k && k !== 'Sin tipo')
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: id, value }));
  const topBarriosObras = [...obrasPorBarrio.entries()]
    .filter(([k]) => k && k !== 'Sin barrio')
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([barrio, n]) => ({ barrio, obras: n }));

  const charts = [
    {
      id: 'obras-anuales',
      type: 'area',
      title: 'Obras públicas ejecutadas por año',
      subtitle: 'Pavimento, cordón cuneta y otras intervenciones.',
      data: obrasYearData,
      config: { indexBy: 'anio', keys: ['obras'] },
    },
    {
      id: 'obras-tipo',
      type: 'pie',
      title: 'Obras por tipo de intervención',
      subtitle: 'Composición del programa de obras.',
      data: tipoObrasData,
    },
    {
      id: 'obras-barrios',
      type: 'horizontalBar',
      title: 'Top barrios con obras ejecutadas',
      subtitle: 'Distribución territorial de la inversión pública.',
      data: topBarriosObras,
      config: { indexBy: 'barrio', keys: ['obras'] },
    },
    {
      id: 'fab-yoy',
      type: 'stackedBar',
      title: 'Producción municipal de tubos y bloques por año',
      subtitle: 'Insumos para obra propia y abastecimiento de programas habitacionales.',
      data: fabData,
      config: { indexBy: 'anio', keys: ['tubos', 'bloques'] },
    },
    {
      id: 'tup-yoy',
      type: 'line',
      title: 'Transporte urbano · viajes y kilómetros',
      subtitle: 'Evolución del servicio público de pasajeros.',
      data: tupData,
      config: { indexBy: 'anio', keys: ['viajes', 'km'] },
    },
  ];

  // ── Output ────────────────────────────────────────────
  const data = {
    meta: buildMeta({
      id: SLUG,
      title: 'Obras y Servicios Públicos · Resumen ejecutivo',
      category: SLUG,
      description:
        'Inversión en infraestructura urbana, producción municipal de insumos y prestación del servicio de transporte público.',
      manifestEntry: {
        source_url: 'https://datos-abiertos.venadotuerto.gob.ar/',
        license: 'CC-BY / ODC-BY',
        last_updated: obrDs.last_updated,
        organization: 'Servicios y Obras Públicas',
        notes: '',
      },
    }),
    kpis, charts,
  };
  writeJSON(`public/data/${SLUG}/_resumen.json`, data);

  writeMarkdown(`public/reports/${SLUG}/_resumen.md`, renderMarkdown({
    obrasTotal, totalTubos, totalBloques, totalPlanos, totalSuperficie,
    totalMensuras, totalViajes, totalKm,
  }));

  console.log(`    ✓ ${SLUG}/_resumen (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown(d) {
  return `## Inversión en infraestructura urbana

Entre 2020 y 2025, el municipio ejecutó **${formatNumberAR(d.obrasTotal)} obras de pavimentación, cordón cuneta y otras intervenciones**, distribuidas en barrios de toda la ciudad. La política de obras combina **planificación territorial** —para llegar a sectores postergados— con **demanda vecinal** canalizada por las comisiones barriales.

## Producción propia de insumos

La fábrica municipal produjo **${formatNumberAR(d.totalTubos)} tubos de hormigón** (caños de 400 a 1200 mm) y **${formatNumberAR(d.totalBloques)} bloques** entre 2020 y 2025. Estos insumos abastecen las obras municipales —reduciendo costos de mercado— y los programas habitacionales como Nuestro Terreno.

## Regularización del territorio

Se presentaron **${formatNumberAR(d.totalPlanos)} planos de obra** que totalizan **${formatNumberAR(Math.round(d.totalSuperficie))} m² regularizados**, junto con **${formatNumberAR(d.totalMensuras)} expedientes de mensura** que actualizaron el catastro. Estos trámites son **el paso administrativo previo** a la edificación legal y a la valorización fiscal del territorio.

## Movilidad pública

El sistema de transporte urbano (TUP) acumuló **${formatNumberAR(d.totalViajes)} viajes** recorriendo **${formatNumberAR(Math.round(d.totalKm / 1000))} mil kilómetros** entre 2020 y 2025. La evolución mostrada en el gráfico permite identificar el impacto de la pandemia (2020-21) y la recuperación posterior del uso del servicio.

## Lectura

El conjunto refleja un municipio con **capacidad operativa propia** (fábrica de insumos), un volumen sostenido de obra pública y un servicio de transporte que sirve de columna vertebral para la movilidad urbana. La distribución barrial de las obras y la demanda de planos son indicadores indirectos del **dinamismo edilicio** de la ciudad.
`;
}

module.exports = run;
if (require.main === module) run();
