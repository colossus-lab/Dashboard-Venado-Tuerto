/**
 * Procesa el dataset "mensuras".
 * - Lee 6 archivos anuales (2020-2025): cada fila es un expediente de mensura
 *   con ingreso (DD/M/YYYY), ingreso_scit y tipo (con padding de espacios).
 * - KPIs: total expedientes, tipos distintos, año pico, último año.
 * - Charts: area por año, horizontalBar por tipo.
 */

const {
  readCSV,
  parseDDMMYYYY,
  extractYearFromPath,
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

const REPORT_ID = 'obras-servicios/mensuras';
const CKAN_ID = 'mensuras';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const anioFile = extractYearFromPath(res.local_path);
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      const fechaIngreso = parseDDMMYYYY(r.ingreso);
      const tipo = String(r.tipo || '').trim();
      all.push({
        anio: fechaIngreso ? fechaIngreso.getFullYear() : anioFile,
        tipo,
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const total = all.length;
  const tiposDistintos = new Set(all.map((r) => r.tipo).filter(Boolean)).size;

  const porAnio = countBy(all, (r) => r.anio);
  const yearsSorted = [...porAnio.keys()].filter(Boolean).sort((a, b) => a - b);
  const yearPico = yearsSorted.reduce((max, y) => (porAnio.get(y) > porAnio.get(max) ? y : max), yearsSorted[0]);
  const lastYear = yearsSorted[yearsSorted.length - 1];

  const kpis = [
    buildKPI({
      id: 'total',
      label: 'Expedientes totales',
      value: total,
      formatted: formatNumberAR(total),
      hint: `Acumulado ${yearsSorted[0] || '—'}–${lastYear || '—'}.`,
    }),
    buildKPI({
      id: 'tipos',
      label: 'Tipos de mensura',
      value: tiposDistintos,
      formatted: formatNumberAR(tiposDistintos),
      hint: 'Mensura simple, división, subdivisión, unificación, regularización, etc.',
    }),
    buildKPI({
      id: 'anio-pico',
      label: 'Año con más expedientes',
      value: porAnio.get(yearPico) || 0,
      formatted: String(yearPico),
      hint: `${formatNumberAR(porAnio.get(yearPico) || 0)} expedientes ingresados`,
    }),
    buildKPI({
      id: 'ultimo-anio',
      label: `Expedientes ${lastYear}`,
      value: porAnio.get(lastYear) || 0,
      formatted: formatNumberAR(porAnio.get(lastYear) || 0),
      hint: 'Volumen del último año disponible.',
    }),
  ];

  // ─── Charts ───

  // 1. Por año
  const anioData = yearsSorted.map((y) => ({ anio: String(y), expedientes: porAnio.get(y) || 0 }));

  // 2. Por tipo (top 12)
  const tipoCounts = countBy(
    all.filter((r) => r.tipo),
    (r) => r.tipo,
  );
  const tipoData = [...tipoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([t, c]) => ({
      tipo: t.length > 32 ? t.slice(0, 30) + '…' : t,
      expedientes: c,
    }));

  const charts = [
    {
      id: 'por-anio',
      type: 'area',
      title: 'Expedientes de mensura por año',
      subtitle: 'Cantidad de mensuras presentadas en el municipio anualmente.',
      data: anioData,
      config: { indexBy: 'anio', keys: ['expedientes'] },
    },
    {
      id: 'por-tipo',
      type: 'horizontalBar',
      title: 'Expedientes por tipo de mensura (top 12)',
      subtitle: 'Tipos más frecuentes: división, subdivisión, conformación parcelaria, etc.',
      data: tipoData,
      config: { indexBy: 'tipo', keys: ['expedientes'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Expedientes de Mensura',
      category: 'obras-servicios',
      description:
        'Mensuras presentadas y registradas en el municipio: trámites técnico-jurídicos sobre inmuebles que definen, modifican o regularizan los límites parcelarios. Incluye divisiones, subdivisiones, unificaciones y regularizaciones.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({
    total,
    tiposDistintos,
    yearPico,
    yearPicoCount: porAnio.get(yearPico) || 0,
    yearsRange: yearsSorted.length > 0 ? `${yearsSorted[0]}–${lastYear}` : '—',
  });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, tiposDistintos, yearPico, yearPicoCount, yearsRange }) {
  return `## Resumen

Entre **${yearsRange}**, ingresaron **${formatNumberAR(total)} expedientes de mensura** al municipio, agrupados en **${formatNumberAR(tiposDistintos)} tipos** distintos. El año con mayor volumen fue **${yearPico}** con **${formatNumberAR(yearPicoCount)} expedientes**.

## Qué es una mensura

La **mensura** es un trámite técnico-jurídico que define, modifica o regulariza los **límites parcelarios** de un inmueble. La realiza un agrimensor matriculado y se aprueba en el Servicio de Catastro e Información Territorial (SCIT) provincial. El municipio interviene como receptor del expediente y emisor de constancias de pago de tasas y regularización urbana.

## Tipos frecuentes

- **Mensura y división:** subdivide un lote en varios.
- **Mensura y subdivisión:** análoga, con matices técnicos según la normativa local.
- **Mensura y unificación:** combina dos o más lotes en uno solo.
- **Mensura para regularización:** ajusta parcelas a la realidad físico-jurídica (rectificación de medidas, reconocimiento de posesión, regularización dominial).
- **Mensura conforme a obra:** registra la edificación efectivamente construida.

## Indicador económico

El volumen de mensuras es un buen indicador del **dinamismo inmobiliario** local: aumentos sostenidos suelen reflejar nuevos loteos, urbanizaciones o programas de regularización dominial; caídas suelen acompañar contracciones del mercado.

## Sobre los datos

Cada registro contiene la fecha de ingreso del expediente al municipio, la fecha de ingreso al SCIT (cuando aplica) y el tipo de mensura. No incluye datos del titular, ubicación específica del inmueble ni superficies involucradas.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
