/**
 * Análisis ejecutivo de HACIENDA Y ECONOMÍA.
 * Sintetiza: balances de tesorería, habilitaciones comerciales, establecimientos,
 * Conecta Empleo y hogares de convivencia.
 */

const {
  readCSV, parseSpanishNumber, extractYearFromPath, countBy, sumBy,
  writeJSON, writeMarkdown, loadManifest, findDataset, localPath,
  formatNumberAR, formatCurrencyARS, buildKPI, buildMeta,
} = require('./lib/csv-utils.cjs');

const SLUG = 'hacienda-economia';

function run() {
  console.log(`\n  → ${SLUG} (resumen ejecutivo)`);
  const m = loadManifest();
  const balDs   = findDataset(m, 'balances-de-tesoreria');
  const habDs   = findDataset(m, 'habilitaciones-comerciales');
  const estDs   = findDataset(m, 'establecimientos-comerciales-habilitados');
  const conDs   = findDataset(m, 'capacitaciones-conecta-empleo');
  const hogDs   = findDataset(m, 'hogares-de-convivencia');

  // ── Habilitaciones comerciales por año (mensual) ─────────────
  const habByYear = new Map();
  for (const res of habDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    let total = 0;
    for (const r of rows) {
      const val = parseSpanishNumber(r[String(year)] || r[Object.keys(r).find(k => k !== 'Mes')]);
      if (Number.isFinite(val)) total += val;
    }
    habByYear.set(year, total);
  }
  const totalHab = [...habByYear.values()].reduce((a, b) => a + b, 0);
  const hab2025 = habByYear.get(2025) || 0;
  const hab2024 = habByYear.get(2024) || 0;
  const habYoY = hab2024 > 0 ? ((hab2025 - hab2024) / hab2024) * 100 : 0;

  // ── Establecimientos vigentes ──────────────────────────────
  const estRows = readCSV(localPath(estDs.resources[0]));
  const totalEst = estRows.length;

  // Top barrios y rubros
  const barriosEst = countBy(estRows, r => String(r.barrio || '(sin)').trim());
  const topBarrios = [...barriosEst.entries()]
    .filter(([k]) => k && k !== '(sin)')
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([barrio, n]) => ({ barrio, comercios: n }));

  // Rubros: cada fila puede tener varios separados por coma
  const rubroCounts = new Map();
  for (const r of estRows) {
    const rubros = String(r.rubros || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    for (const ru of rubros) {
      const key = ru.length > 50 ? ru.slice(0, 47) + '…' : ru;
      rubroCounts.set(key, (rubroCounts.get(key) || 0) + 1);
    }
  }
  const topRubros = [...rubroCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([rubro, n]) => ({ rubro, total: n }));

  // ── Conecta Empleo: capacitados por año + género ──────────
  const conByYear = new Map();
  let conTotal = 0;
  let conMujeres = 0;
  for (const res of conDs.resources) {
    const year = extractYearFromPath(res.local_path);
    if (!year) continue;
    const rows = readCSV(localPath(res));
    conByYear.set(year, (conByYear.get(year) || 0) + rows.length);
    conTotal += rows.length;
    for (const r of rows) {
      const g = String(r.genero || '').toUpperCase().trim();
      if (g === 'F' || g === 'FEMENINO') conMujeres += 1;
    }
  }
  const conData = [...conByYear.keys()].sort().map(y => ({
    anio: String(y), capacitados: conByYear.get(y) || 0,
  }));
  const pctMujeres = conTotal > 0 ? (conMujeres / conTotal) * 100 : 0;

  // ── Hogares de convivencia ──────────────────────────────────
  const hogRows = readCSV(localPath(hogDs.resources[0]));
  const totalHogares = hogRows.length;

  // ── Tesorería: leemos archivo 2025 y agregamos por mes ─────
  // El formato es wide: filas son "conceptos", columnas son meses.
  const balRes = balDs.resources.find(r => /balance-2025|2025/i.test(r.local_path));
  const balRows = balRes ? readCSV(localPath(balRes)) : [];
  const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SETIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const ingresosRow = balRows.find(r => /^B\.\s*INGRESOS/i.test(String(r.Conceptos || '').trim()))
                   || balRows.find(r => /TOTAL.*INGRESOS/i.test(String(r.Conceptos || '').trim()));
  const egresosRow = balRows.find(r => /^C\.\s*EGRESOS/i.test(String(r.Conceptos || '').trim()))
                   || balRows.find(r => /TOTAL.*EGRESOS/i.test(String(r.Conceptos || '').trim()));
  const ingresosMes = meses.map(m => ({
    mes: m.slice(0, 3),
    ingresos: ingresosRow ? parseSpanishNumber(ingresosRow[m]) || 0 : 0,
    egresos: egresosRow ? parseSpanishNumber(egresosRow[m]) || 0 : 0,
  })).filter(x => x.ingresos > 0 || x.egresos > 0);

  const totalIngresos = sumBy(ingresosMes, r => r.ingresos);
  const totalEgresos = sumBy(ingresosMes, r => r.egresos);

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'establecimientos',
      label: 'Comercios habilitados vigentes',
      value: totalEst,
      formatted: formatNumberAR(totalEst),
      hint: `Distribuidos en ${barriosEst.size} barrios`,
    }),
    buildKPI({
      id: 'habilitaciones',
      label: 'Habilitaciones acumuladas (2020-2025)',
      value: totalHab,
      formatted: formatNumberAR(totalHab),
      hint: hab2024 > 0 ? `${hab2025} en 2025 (${habYoY >= 0 ? '+' : ''}${habYoY.toFixed(1).replace('.', ',')}% vs 2024)` : undefined,
    }),
    buildKPI({
      id: 'conecta',
      label: 'Capacitados Conecta Empleo',
      value: conTotal,
      formatted: formatNumberAR(conTotal),
      hint: `${pctMujeres.toFixed(1).replace('.', ',')}% mujeres`,
      status: 'good',
    }),
    buildKPI({
      id: 'hogares',
      label: 'Hogares de convivencia',
      value: totalHogares,
      formatted: formatNumberAR(totalHogares),
      hint: 'Habilitación municipal vigente',
    }),
  ];
  if (totalIngresos > 0) {
    kpis.push(buildKPI({
      id: 'ingresos-2025',
      label: 'Ingresos tesorería 2025',
      value: Math.round(totalIngresos),
      formatted: formatCurrencyARS(totalIngresos),
      hint: `Egresos: ${formatCurrencyARS(totalEgresos)}`,
    }));
  }

  // ── Charts ────────────────────────────────────────────────
  const charts = [
    {
      id: 'hab-yoy',
      type: 'bar',
      title: 'Habilitaciones comerciales por año',
      subtitle: 'Cantidad anual de nuevas habilitaciones emitidas.',
      data: [...habByYear.keys()].sort().map(y => ({
        anio: String(y), habilitaciones: habByYear.get(y) || 0,
      })),
      config: { indexBy: 'anio', keys: ['habilitaciones'] },
    },
    {
      id: 'top-barrios',
      type: 'horizontalBar',
      title: 'Top barrios con comercios habilitados',
      subtitle: 'Concentración geográfica de la actividad económica.',
      data: topBarrios,
      config: { indexBy: 'barrio', keys: ['comercios'] },
    },
    {
      id: 'top-rubros',
      type: 'horizontalBar',
      title: 'Rubros más frecuentes',
      subtitle: 'Top 8 rubros declarados en habilitaciones vigentes.',
      data: topRubros,
      config: { indexBy: 'rubro', keys: ['total'] },
    },
    {
      id: 'conecta-yoy',
      type: 'area',
      title: 'Capacitaciones Conecta Empleo por año',
      subtitle: 'Personas formadas por la Dirección de Empleo.',
      data: conData,
      config: { indexBy: 'anio', keys: ['capacitados'] },
    },
  ];

  if (ingresosMes.length > 0) {
    charts.push({
      id: 'tesoreria',
      type: 'line',
      title: 'Tesorería 2025: ingresos vs egresos',
      subtitle: 'Flujo financiero mensual reportado en balance.',
      data: ingresosMes,
      config: { indexBy: 'mes', keys: ['ingresos', 'egresos'] },
    });
  }

  // ── Output ────────────────────────────────────────────────
  const data = {
    meta: buildMeta({
      id: SLUG,
      title: 'Hacienda y Economía · Resumen ejecutivo',
      category: SLUG,
      description:
        'Tablero económico-financiero del municipio: comercio, empleo, finanzas y políticas de promoción productiva.',
      manifestEntry: {
        source_url: 'https://datos-abiertos.venadotuerto.gob.ar/',
        license: 'CC-BY / ODC-BY',
        last_updated: estDs.last_updated,
        organization: 'Desarrollo Económico · Desarrollo Productivo',
        notes: '',
      },
    }),
    kpis, charts,
  };
  writeJSON(`public/data/${SLUG}/_resumen.json`, data);

  writeMarkdown(`public/reports/${SLUG}/_resumen.md`, renderMarkdown({
    totalEst, totalHab, hab2025, habYoY, conTotal, pctMujeres,
    totalHogares, totalIngresos, totalEgresos,
    barrios: barriosEst.size,
  }));

  console.log(`    ✓ ${SLUG}/_resumen (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown(d) {
  return `## Tejido comercial

Venado Tuerto cuenta con **${formatNumberAR(d.totalEst)} establecimientos comerciales habilitados** distribuidos en **${formatNumberAR(d.barrios)} barrios**. Entre 2020 y 2025 se emitieron **${formatNumberAR(d.totalHab)} habilitaciones nuevas**${d.hab2025 ? `, con ${formatNumberAR(d.hab2025)} en 2025` : ''}${d.habYoY ? ` (${d.habYoY >= 0 ? 'aumento' : 'caída'} de ${Math.abs(d.habYoY).toFixed(1).replace('.', ',')}% respecto a 2024)` : ''}.

## Empleo y formación

El programa **Conecta Empleo** capacitó a **${formatNumberAR(d.conTotal)} personas** desde 2020, con una **participación femenina del ${d.pctMujeres.toFixed(1).replace('.', ',')}%**. Las capacitaciones cubren oficios técnicos (autoelevadores, soldadura), competencias digitales y formación profesional vinculada al entramado productivo local.

## Cuidado y servicios

La ciudad tiene **${formatNumberAR(d.totalHogares)} hogares de convivencia** habilitados —residencias para adultos mayores y personas con discapacidad— bajo control municipal sanitario.

${d.totalIngresos > 0 ? `## Salud financiera

En 2025 la tesorería municipal registró ingresos por **${formatCurrencyARS(d.totalIngresos)}** y egresos por **${formatCurrencyARS(d.totalEgresos)}**, dejando un resultado financiero ${d.totalIngresos > d.totalEgresos ? 'positivo' : 'deficitario'} de ${formatCurrencyARS(Math.abs(d.totalIngresos - d.totalEgresos))}.` : ''}

## Lectura

La economía local muestra un comercio establecido y diversificado, con políticas activas de inserción laboral. La concentración geográfica de comercios y la oferta formativa son insumos clave para políticas de desarrollo barrial.
`;
}

module.exports = run;
if (require.main === module) run();
