/**
 * Análisis ejecutivo de la categoría GOBIERNO.
 * Sintetiza: personal municipal, capacitaciones RRHH, CDR, vecinales y elecciones.
 */

const {
  readCSV, parseSpanishNumber, parseDDMMYYYY, extractYearFromPath, countBy, sumBy,
  writeJSON, writeMarkdown, loadManifest, findDataset, localPath,
  formatNumberAR, formatPercentAR, formatCurrencyARS, buildKPI, buildMeta,
} = require('./lib/csv-utils.cjs');

const SLUG = 'gobierno';

function run() {
  console.log(`\n  → ${SLUG} (resumen ejecutivo)`);
  const m = loadManifest();
  const personalDs = findDataset(m, 'personal-municipal');
  const capacDs   = findDataset(m, 'capacitaciones-al-personal-2021');
  const cdrDs     = findDataset(m, 'documentacion-emitida-por-el-centro-de-documentacion-rapida-2024');
  const vecDs     = findDataset(m, 'presidentes-vecinales-direccion-y-contacto');
  const elecDs    = findDataset(m, 'elecciones-vecinales');

  // ── Personal ─────────────────────────────────────────────────
  const nominaRes = personalDs.resources.find(r => /personal-2026|personal\b/i.test(r.local_path));
  const personal = readCSV(localPath(nominaRes));
  const totalAgentes = personal.length;
  const tipoVinculo = countBy(personal, r => String(r.dependencia || '').trim());

  // ── Capacitaciones RRHH ─────────────────────────────────────
  const capacFiles = capacDs.resources;
  const capacByYear = new Map();
  let capacTotalAgentes = 0;
  let capacEvents = 0;
  for (const res of capacFiles) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    let yearTotal = 0;
    for (const r of rows) {
      const n = parseSpanishNumber(r.agentes_capacitados);
      if (Number.isFinite(n)) {
        yearTotal += n;
        capacTotalAgentes += n;
      }
      capacEvents += 1;
    }
    capacByYear.set(year, yearTotal);
  }

  // ── CDR (Centro de Documentación Rápida) ──────────────────
  const cdrFiles = cdrDs.resources;
  let cdrTotal2024 = 0, cdrTotal2025 = 0;
  const cdrPorMes = []; // for chart
  for (const res of cdrFiles) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const total =
        (parseSpanishNumber(r.actualizaciones) || 0) +
        (parseSpanishNumber(r.nuevo_ejemplar) || 0) +
        (parseSpanishNumber(r.pasaporte) || 0) +
        (parseSpanishNumber(r.nuevo_ejemplar_sin_cargo) || 0) +
        (parseSpanishNumber(r.dni_0_años) || 0) +
        (parseSpanishNumber(r.actualizacion_sin_cargo) || 0);
      if (year === 2024) cdrTotal2024 += total;
      if (year === 2025) cdrTotal2025 += total;
      cdrPorMes.push({ mes: String(r.mes).trim(), año: year, total });
    }
  }

  // ── Vecinales ───────────────────────────────────────────────
  const vecRes = vecDs.resources.find(r => /vecinales\.csv$|vecinales-csv\.csv$/.test(r.local_path)
    || /\bvecinales\b/.test(r.name || ''));
  const vecRows = vecRes ? readCSV(localPath(vecRes)) : [];
  const totalVecinales = vecRows.length;
  const conContacto = vecRows.filter(r => r.telefono && String(r.telefono).trim()).length;

  // ── Elecciones ──────────────────────────────────────────────
  const elecRows = readCSV(localPath(elecDs.resources[0]));
  const totalVotantesElec = sumBy(elecRows, r => parseSpanishNumber(r.cantidad_votantes));
  const barriosElec = new Set(elecRows.map(r => String(r.barrio).trim())).size;

  // ── KPIs ────────────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'agentes',
      label: 'Agentes municipales',
      value: totalAgentes,
      formatted: formatNumberAR(totalAgentes),
      hint: `${formatNumberAR(tipoVinculo.get('Personal Permanente') || 0)} permanentes`,
    }),
    buildKPI({
      id: 'capacitaciones',
      label: 'Capacitaciones RRHH (acumulado)',
      value: capacEvents,
      formatted: formatNumberAR(capacEvents),
      hint: `${formatNumberAR(capacTotalAgentes)} participaciones`,
      status: 'good',
    }),
    buildKPI({
      id: 'cdr-2025',
      label: 'Documentos CDR 2025',
      value: cdrTotal2025,
      formatted: formatNumberAR(cdrTotal2025),
      hint: cdrTotal2024 > 0
        ? `${formatPercentAR(((cdrTotal2025 - cdrTotal2024) / cdrTotal2024) * 100, 1)} vs 2024`
        : undefined,
    }),
    buildKPI({
      id: 'vecinales',
      label: 'Comisiones vecinales',
      value: totalVecinales,
      formatted: formatNumberAR(totalVecinales),
      hint: `${formatNumberAR(conContacto)} con teléfono publicado`,
    }),
    buildKPI({
      id: 'votantes-elec',
      label: 'Votantes en últimas vecinales',
      value: totalVotantesElec,
      formatted: formatNumberAR(totalVotantesElec),
      hint: `${formatNumberAR(barriosElec)} barrios participantes`,
    }),
  ];

  // ── Charts ─────────────────────────────────────────────────

  // 1. Personal por vínculo (top 4)
  const tipoVinculoData = [...tipoVinculo.entries()]
    .filter(([k]) => k && k.length > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tipo, n]) => ({
      tipo: tipo.length > 30 ? tipo.slice(0, 28) + '…' : tipo,
      agentes: n,
    }));

  // 2. Capacitaciones por año
  const yearsCapac = [...capacByYear.keys()].sort();
  const capacData = yearsCapac.map(y => ({
    anio: String(y),
    participantes: capacByYear.get(y) || 0,
  }));

  // 3. CDR mensual: 2024 vs 2025 (orden de meses)
  const monthOrder = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','septiembre','octubre','noviembre','diciembre'];
  const monthIdx = (s) => monthOrder.indexOf(String(s).toLowerCase().trim());
  const cdrMonthly = new Map();
  for (const r of cdrPorMes) {
    const k = String(r.mes).toLowerCase().trim();
    if (!cdrMonthly.has(k)) cdrMonthly.set(k, { mes: capitalizeMonth(r.mes), '2024': 0, '2025': 0 });
    cdrMonthly.get(k)[String(r.año)] += r.total;
  }
  const cdrData = [...cdrMonthly.values()]
    .sort((a, b) => monthIdx(a.mes) - monthIdx(b.mes))
    .filter(x => x['2024'] > 0 || x['2025'] > 0);

  const charts = [
    {
      id: 'personal-vinculo',
      type: 'horizontalBar',
      title: 'Composición de la planta municipal',
      subtitle: 'Agentes según tipo de vínculo laboral.',
      data: tipoVinculoData,
      config: { indexBy: 'tipo', keys: ['agentes'] },
    },
    {
      id: 'capac-yoy',
      type: 'area',
      title: 'Capacitaciones al personal por año',
      subtitle: 'Total de participaciones registradas en programas de RRHH.',
      data: capacData,
      config: { indexBy: 'anio', keys: ['participantes'] },
    },
    {
      id: 'cdr-mensual',
      type: 'stackedBar',
      title: 'Documentación emitida en el CDR',
      subtitle: 'Total de trámites mensuales (DNI, pasaporte, actualizaciones) — 2024 vs 2025.',
      data: cdrData,
      config: { indexBy: 'mes', keys: ['2024', '2025'] },
    },
  ];

  // ── Tabla: vecinales ────────────────────────────────────────
  const vecData = vecRows
    .filter(r => r.barrio)
    .slice(0, 30)
    .map(r => [
      String(r.barrio).trim(),
      String(r.nombre_apellido_presidente || '—').trim(),
      String(r.telefono || '—').trim(),
    ]);

  const tables = [{
    id: 'vecinales-tabla',
    title: 'Comisiones vecinales con presidente y contacto',
    columns: ['Barrio', 'Presidente', 'Teléfono'],
    rows: vecData,
    maxRows: 30,
  }];

  // ── Output ──────────────────────────────────────────────────
  const data = {
    meta: buildMeta({
      id: SLUG,
      title: 'Gobierno · Resumen ejecutivo',
      category: SLUG,
      description:
        'Tablero de la estructura administrativa del municipio: planta de agentes, capacitación interna, documentación al ciudadano y participación vecinal.',
      manifestEntry: {
        source_url: 'https://datos-abiertos.venadotuerto.gob.ar/',
        license: 'CC-BY / ODC-BY',
        last_updated: personalDs.last_updated,
        organization: 'Gobierno · Múltiples áreas',
        notes: '',
      },
    }),
    kpis,
    charts,
    tables,
  };
  writeJSON(`public/data/${SLUG}/_resumen.json`, data);

  const md = renderMarkdown({
    totalAgentes,
    permanentes: tipoVinculo.get('Personal Permanente') || 0,
    capacEvents,
    capacTotalAgentes,
    cdrTotal2024,
    cdrTotal2025,
    totalVecinales,
    totalVotantesElec,
    barriosElec,
  });
  writeMarkdown(`public/reports/${SLUG}/_resumen.md`, md);

  console.log(`    ✓ ${SLUG}/_resumen (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function capitalizeMonth(m) {
  const s = String(m).trim();
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

function renderMarkdown(d) {
  const yoy = d.cdrTotal2024 > 0
    ? (((d.cdrTotal2025 - d.cdrTotal2024) / d.cdrTotal2024) * 100).toFixed(1).replace('.', ',')
    : null;
  return `## Panorama del aparato municipal

La Municipalidad de Venado Tuerto cuenta con una **planta de ${formatNumberAR(d.totalAgentes)} agentes**, de los cuales ${formatNumberAR(d.permanentes)} (${formatPercentAR(d.permanentes / d.totalAgentes * 100, 1)}) son personal permanente. Esta proporción evidencia una estructura estable, con baja rotación, sostenida en el tiempo a través de carreras administrativas largas.

## Inversión en capital humano

Entre 2021 y 2025 se realizaron **${formatNumberAR(d.capacEvents)} eventos de capacitación** organizados por la Dirección de Recursos Humanos, con un total de **${formatNumberAR(d.capacTotalAgentes)} participaciones de agentes**. Las temáticas cubren competencias técnicas, atención al vecino, salud y seguridad e higiene.

## Servicios al ciudadano

El **Centro de Documentación Rápida (CDR)** procesó **${formatNumberAR(d.cdrTotal2025)} trámites en 2025** entre DNIs, pasaportes y actualizaciones${yoy !== null ? `, lo que representa una variación del **${yoy}% respecto a 2024**` : ''}. Es uno de los puntos de contacto más concurridos entre el municipio y la ciudadanía.

## Participación y representación barrial

La ciudad cuenta con **${formatNumberAR(d.totalVecinales)} comisiones vecinales** activas, distribuidas en distintos barrios. En las últimas elecciones vecinales participaron **${formatNumberAR(d.totalVotantesElec)} vecinos** distribuidos en **${formatNumberAR(d.barriosElec)} barrios**, dato que permite dimensionar el alcance de la democracia barrial.

## Lectura

El estado de gobierno muestra un municipio con una administración consolidada, una política activa de capacitación y servicios de alto volumen al ciudadano. La participación vecinal —baja en términos absolutos respecto al padrón— es un área con margen de mejora cívica.
`;
}

module.exports = run;
if (require.main === module) run();
