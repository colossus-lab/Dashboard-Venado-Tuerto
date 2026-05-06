/**
 * Procesa el dataset "personal-municipal" del portal CKAN de Venado Tuerto.
 * - Lee 2 archivos: nómina de agentes y escala salarial 2025.
 * - Calcula KPIs (total, % permanentes, antigüedad promedio, masa salarial estimada).
 * - Genera charts: distribución por vínculo, por categoría, ingresos por año.
 * - Genera tabla: escala salarial vigente.
 * - Emite public/data/gobierno/personal-municipal.json + public/reports/.../md.
 */

const path = require('path');
const {
  readCSV,
  parseSpanishNumber,
  parseDDMMYYYY,
  countBy,
  sumBy,
  topN,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  formatPercentAR,
  formatCurrencyARS,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'gobierno/personal-municipal';
const CKAN_ID = 'personal-municipal';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  // Identificar los 2 recursos por keyword en el filename
  const nominaRes = ds.resources.find((r) => /personal-2026|personal_2026|personal\b/i.test(r.local_path));
  const escalaRes = ds.resources.find((r) => /escala-salarial|escala_salarial/i.test(r.local_path));

  if (!nominaRes) throw new Error('No se encontró el archivo de nómina');
  if (!escalaRes) console.warn('  ⚠ No se encontró la escala salarial — masa salarial no calculada');

  const rows = readCSV(localPath(nominaRes)).map((r) => ({
    legajo: String(r.legajo || '').trim(),
    empleado: String(r.empleado || '').trim(),
    dependencia: String(r.dependencia || '').trim(),
    ingreso: String(r.ingreso || '').trim(),
    categoria: String(r.categoria || '').trim(),
  }));

  console.log(`    rows: ${rows.length}`);

  // ─── Escala salarial 2025-01 ───
  let escalaPorCategoria = new Map();
  let escalaMesReferencia = '2025-01';
  if (escalaRes) {
    const escalaRows = readCSV(localPath(escalaRes));
    // Primer mes disponible
    const meses = [...new Set(escalaRows.map((r) => String(r.mes).trim()))].sort();
    escalaMesReferencia = meses[0] || '2025-01';
    for (const r of escalaRows) {
      if (String(r.mes).trim() !== escalaMesReferencia) continue;
      const cat = String(r.categoria).trim();
      const val = parseSpanishNumber(r.valor_ars);
      if (cat && Number.isFinite(val)) escalaPorCategoria.set(cat, val);
    }
  }

  // ─── KPIs ───
  const total = rows.length;
  const tipoVinculoCounts = countBy(rows, (r) => r.dependencia || '(sin dato)');
  const permanentes = tipoVinculoCounts.get('Personal Permanente') || 0;
  const pctPermanentes = total > 0 ? (permanentes / total) * 100 : 0;

  // Antigüedad
  const today = new Date();
  const antiguedades = rows
    .map((r) => parseDDMMYYYY(r.ingreso))
    .filter(Boolean)
    .map((d) => (today - d) / (1000 * 60 * 60 * 24 * 365.25));
  const antiguedadPromedio =
    antiguedades.length > 0
      ? antiguedades.reduce((a, b) => a + b, 0) / antiguedades.length
      : 0;

  // Masa salarial estimada (sumar el valor base de la categoría de cada agente)
  const masaSalarial = sumBy(rows, (r) => {
    // categoria viene como "Categoria 15" → extraer número
    const m = r.categoria.match(/(\d+)/);
    if (!m) return 0;
    const catKey = m[1].replace(/^0+/, '') || '0';
    const val = escalaPorCategoria.get(catKey) || escalaPorCategoria.get(`0${catKey}`) || 0;
    return val;
  });

  const kpis = [
    buildKPI({
      id: 'total',
      label: 'Total agentes',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'personas',
    }),
    buildKPI({
      id: 'pct-permanente',
      label: 'Personal permanente',
      value: pctPermanentes,
      formatted: formatPercentAR(pctPermanentes, 1),
      hint: `${formatNumberAR(permanentes)} de ${formatNumberAR(total)} agentes`,
      status: 'good',
    }),
    buildKPI({
      id: 'antiguedad',
      label: 'Antigüedad promedio',
      value: Number(antiguedadPromedio.toFixed(1)),
      formatted: `${antiguedadPromedio.toFixed(1).replace('.', ',')}`,
      unit: 'años',
    }),
  ];

  if (masaSalarial > 0) {
    kpis.push(
      buildKPI({
        id: 'masa-salarial',
        label: 'Masa salarial estimada',
        value: Math.round(masaSalarial),
        formatted: formatCurrencyARS(masaSalarial),
        hint: `Mensual base · escala ${escalaMesReferencia}`,
      }),
    );
  }

  // ─── Charts ───

  // 1. Por tipo de vínculo
  const tipoVinculoData = [...tipoVinculoCounts.entries()]
    .filter(([k]) => k && k !== '(sin dato)')
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, count]) => ({
      tipo: tipo.length > 35 ? tipo.slice(0, 33) + '…' : tipo,
      agentes: count,
    }));

  // 2. Por categoría escalafonaria
  const categoriaCounts = countBy(rows, (r) => {
    const m = r.categoria.match(/Categoria\s*0?(\d+)/i);
    return m ? `Cat. ${m[1].padStart(2, '0')}` : '(sin)';
  });
  const categoriaData = [...categoriaCounts.entries()]
    .filter(([k]) => k !== '(sin)')
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, count]) => ({ categoria: cat, agentes: count }));

  // 3. Ingresos por año
  const ingresosPorAnio = countBy(
    rows
      .map((r) => parseDDMMYYYY(r.ingreso))
      .filter(Boolean)
      .map((d) => d.getFullYear()),
    (y) => y,
  );
  const yearsSorted = [...ingresosPorAnio.keys()].sort((a, b) => a - b);
  const minYear = Math.max(yearsSorted[0] || 1990, 1990);
  const ingresosData = [];
  for (let y = minYear; y <= today.getFullYear(); y++) {
    ingresosData.push({ anio: String(y), ingresos: ingresosPorAnio.get(y) || 0 });
  }

  const charts = [
    {
      id: 'tipo-vinculo',
      type: 'horizontalBar',
      title: 'Agentes por tipo de vínculo laboral',
      subtitle: 'Personal permanente, contratado, gabinete y otros.',
      data: tipoVinculoData,
      config: { indexBy: 'tipo', keys: ['agentes'] },
    },
    {
      id: 'categoria',
      type: 'bar',
      title: 'Agentes por categoría escalafonaria',
      subtitle: 'Distribución por escala salarial.',
      data: categoriaData,
      config: { indexBy: 'categoria', keys: ['agentes'] },
    },
    {
      id: 'ingresos-anio',
      type: 'area',
      title: 'Ingresos al municipio por año',
      subtitle: `Cantidad de agentes que ingresaron cada año (${minYear}–${today.getFullYear()}).`,
      data: ingresosData,
      config: { indexBy: 'anio', keys: ['ingresos'] },
    },
  ];

  // ─── Tabla: Escala salarial ───
  const tables = [];
  if (escalaPorCategoria.size > 0) {
    const rowsSal = [...escalaPorCategoria.entries()]
      .map(([cat, val]) => [
        `Categoría ${cat.padStart(2, '0')}`,
        formatCurrencyARS(val),
      ])
      .sort((a, b) => a[0].localeCompare(b[0]));
    tables.push({
      id: 'escala-salarial',
      title: `Escala salarial vigente (${escalaMesReferencia})`,
      columns: ['Categoría', 'Sueldo básico mensual'],
      rows: rowsSal,
    });
  }

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Personal Municipal',
      category: 'gobierno',
      description:
        'Información sobre los agentes municipales de Venado Tuerto: vínculo laboral, categoría escalafonaria, fecha de ingreso y escala salarial vigente.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables,
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    total,
    permanentes,
    pctPermanentes,
    antiguedadPromedio,
    masaSalarial,
    escalaMesReferencia,
    masYoungestYear: minYear,
    tipoVinculoData,
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts · ${tables.length} tablas)`);
}

function renderMarkdown({ total, permanentes, pctPermanentes, antiguedadPromedio, masaSalarial, escalaMesReferencia, masYoungestYear }) {
  return `## Resumen

La Municipalidad de Venado Tuerto cuenta con **${formatNumberAR(total)} agentes** activos. De ellos, **${formatNumberAR(permanentes)}** son personal permanente (${formatPercentAR(pctPermanentes, 1)} del total), lo que indica una planta estable con bajo nivel de rotación.

La **antigüedad promedio** de la planta es de **${antiguedadPromedio.toFixed(1).replace('.', ',')} años**, calculada sobre la fecha de ingreso registrada en cada legajo.

## Composición por vínculo laboral

El listado distingue cuatro tipos de vínculo: **Personal Permanente** (mayoría), **Personal Contratado**, **Gabinete** y **Departamento Ejecutivo**. La proporción de personal permanente es un indicador de la estabilidad estructural del municipio.

## Categoría escalafonaria

Cada agente se ubica en una categoría dentro de la escala municipal (de Categoría 8 a Categoría 24, aproximadamente). Las categorías más bajas corresponden a operativos y administrativos iniciales; las más altas, a jefaturas y direcciones.

## Antigüedad y trayectoria

El gráfico de **ingresos por año** muestra la dinámica de incorporaciones desde ${masYoungestYear}. Picos puntuales suelen corresponder a cambios de gestión o regularizaciones de planta.

${
  masaSalarial > 0
    ? `## Masa salarial estimada

Cruzando la categoría de cada agente con la **escala salarial publicada para ${escalaMesReferencia}** (sueldo básico, sin adicionales ni antigüedad), se obtiene una masa salarial básica estimada de **${formatCurrencyARS(masaSalarial)} mensuales**. Esta cifra es un piso: los salarios efectivos incluyen antigüedad, presentismo, adicionales por función, horas extras y aportes patronales no contemplados aquí.`
    : ''
}

## Sobre los datos

El dataset se actualiza periódicamente desde el sistema interno de Recursos Humanos del municipio y se publica con datos de identificación seudonimizados (apellido, nombre y CUIT).
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
