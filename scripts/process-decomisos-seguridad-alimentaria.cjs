/**
 * Procesa el dataset "decomisos-seguridad-alimentaria-2024".
 * - Lee 2 archivos: 2024 + 2025. Cada fila: mes (texto), kg_decomisados, l_decomisados.
 * - KPIs: kg totales, l totales, mes pico, año pico.
 * - Charts: bar kg/mes, bar l/mes, line evolución.
 */

const {
  readCSV,
  parseSpanishNumber,
  extractYearFromPath,
  writeJSON,
  writeMarkdown,
  loadManifest,
  findDataset,
  localPath,
  formatNumberAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'seguridad-convivencia/decomisos-seguridad-alimentaria';
const CKAN_ID = 'decomisos-seguridad-alimentaria-2024';

const MES_MAP = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};
const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const anio = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const mes = String(r.mes || '').toLowerCase().trim();
      const mesIdx = MES_MAP[mes];
      if (mesIdx === undefined) continue;
      all.push({
        anio,
        mesIdx,
        mesLabel: MES_LABELS[mesIdx],
        kg: parseSpanishNumber(r.kg_decomisados) || 0,
        litros: parseSpanishNumber(r.l_decomisados) || 0,
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const totalKg = all.reduce((s, r) => s + r.kg, 0);
  const totalLitros = all.reduce((s, r) => s + r.litros, 0);

  // Mes pico (por kg)
  const porKg = [...all].sort((a, b) => b.kg - a.kg);
  const picoKg = porKg[0];

  // Año pico (suma kg+l)
  const porAnio = {};
  for (const r of all) {
    if (!porAnio[r.anio]) porAnio[r.anio] = { kg: 0, litros: 0 };
    porAnio[r.anio].kg += r.kg;
    porAnio[r.anio].litros += r.litros;
  }
  const yearsSorted = Object.keys(porAnio).map(Number).sort((a, b) => a - b);
  const yearPico = yearsSorted.reduce((max, y) => (porAnio[y].kg > porAnio[max].kg ? y : max), yearsSorted[0]);

  const kpis = [
    buildKPI({
      id: 'total-kg',
      label: 'Decomisos en kg',
      value: Math.round(totalKg),
      formatted: `${formatNumberAR(Math.round(totalKg))} kg`,
      hint: 'Mercadería sólida decomisada en operativos.',
    }),
    buildKPI({
      id: 'total-litros',
      label: 'Decomisos en litros',
      value: Math.round(totalLitros),
      formatted: `${formatNumberAR(Math.round(totalLitros))} l`,
      hint: 'Líquidos decomisados (lácteos, bebidas, otros).',
    }),
    buildKPI({
      id: 'mes-pico',
      label: 'Mes pico (kg)',
      value: Math.round(picoKg?.kg || 0),
      formatted: picoKg ? `${picoKg.mesLabel} ${picoKg.anio}` : '—',
      hint: picoKg ? `${formatNumberAR(Math.round(picoKg.kg))} kg decomisados` : '',
    }),
    buildKPI({
      id: 'anio-pico',
      label: 'Año con más decomisos',
      value: Math.round(porAnio[yearPico]?.kg || 0),
      formatted: String(yearPico),
      hint: `${formatNumberAR(Math.round(porAnio[yearPico]?.kg || 0))} kg + ${formatNumberAR(Math.round(porAnio[yearPico]?.litros || 0))} l`,
    }),
  ];

  // ─── Charts ───

  // 1. Kg por mes/año
  const sorted = [...all].sort((a, b) => a.anio === b.anio ? a.mesIdx - b.mesIdx : a.anio - b.anio);
  const kgData = sorted.map((r) => ({
    periodo: `${r.mesLabel} ${String(r.anio).slice(-2)}`,
    kg: Math.round(r.kg),
  }));

  // 2. Litros por mes/año
  const litrosData = sorted.map((r) => ({
    periodo: `${r.mesLabel} ${String(r.anio).slice(-2)}`,
    litros: Math.round(r.litros),
  }));

  // 3. Evolución combinada
  const combinedData = sorted.map((r) => ({
    periodo: `${r.mesLabel} ${String(r.anio).slice(-2)}`,
    Kilogramos: Math.round(r.kg),
    Litros: Math.round(r.litros),
  }));

  const charts = [
    {
      id: 'kg-por-mes',
      type: 'bar',
      title: 'Kilogramos decomisados por mes',
      subtitle: 'Mercadería sólida (carnes, alimentos secos, panificados) retirada por inspectores.',
      data: kgData,
      config: { indexBy: 'periodo', keys: ['kg'] },
    },
    {
      id: 'litros-por-mes',
      type: 'bar',
      title: 'Litros decomisados por mes',
      subtitle: 'Líquidos (lácteos, bebidas, otros) retirados de comercios y eventos.',
      data: litrosData,
      config: { indexBy: 'periodo', keys: ['litros'] },
    },
    {
      id: 'evolucion',
      type: 'line',
      title: 'Evolución de decomisos',
      subtitle: 'Comparación de mercadería sólida y líquida mes a mes.',
      data: combinedData,
      config: { indexBy: 'periodo', keys: ['Kilogramos', 'Litros'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Decomisos de Seguridad Alimentaria',
      category: 'seguridad-convivencia',
      description:
        'Mercadería decomisada por la Dirección de Bromatología en operativos de seguridad alimentaria: kilogramos y litros retirados de comercios, eventos y depósitos por incumplimientos sanitarios.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ totalKg, totalLitros, picoKg, yearPico, porAnio });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ totalKg, totalLitros, picoKg, yearPico }) {
  return `## Resumen

Los operativos de **seguridad alimentaria** del municipio retiraron **${formatNumberAR(Math.round(totalKg))} kilogramos** y **${formatNumberAR(Math.round(totalLitros))} litros** de mercadería en condiciones inadecuadas para el consumo. ${picoKg ? `El mes pico fue **${picoKg.mesLabel} ${picoKg.anio}** con **${formatNumberAR(Math.round(picoKg.kg))} kg** decomisados.` : ''}

## Por qué se decomisa

Los decomisos se realizan cuando los inspectores de bromatología constatan: **falta de cadena de frío**, **fechas de vencimiento adulteradas o vencidas**, **almacenamiento en condiciones de riesgo sanitario** (humedad, plagas, contacto con productos no comestibles), **falta de habilitación**, o **adulteración de productos**.

## Tipos de mercadería

- **Sólidos (kg):** carnes, productos cárnicos elaborados (chacinados, embutidos), panificados, productos secos, frutas y verduras.
- **Líquidos (l):** lácteos (leche, yogur), bebidas alcohólicas y no alcohólicas, aceites, productos derivados.

## Operativos típicos

Los inspectores realizan controles de rutina en comercios habilitados (supermercados, carnicerías, panaderías, restaurantes, kioscos), eventos públicos (festivales, ferias, peñas) y zonas de venta ambulante. Los volúmenes elevados suelen coincidir con campañas estacionales (verano: control de cadena de frío) o decomisos puntuales en depósitos clandestinos.

## Sobre los datos

El registro mensual contiene el total agregado de cada operativo: kilogramos y litros decomisados. No discrimina por tipo de mercadería ni por establecimiento. Los datos abarcan desde marzo de 2024.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
