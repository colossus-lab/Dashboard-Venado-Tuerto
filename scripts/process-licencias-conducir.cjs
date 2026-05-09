/**
 * Procesa el dataset "licencias-de-conducir-2025".
 * - Lee 2 archivos: enero-junio + julio-diciembre 2025.
 * - Cada fila es una licencia individual con genero, tipo, clase, fechas.
 * - KPIs: total emitidas, % mujeres, originales vs renovaciones, clases.
 * - Charts: pie género, pie tipo trámite, horizontalBar clases.
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
  formatPercentAR,
  buildKPI,
  buildMeta,
} = require('./lib/csv-utils.cjs');

const REPORT_ID = 'seguridad-convivencia/licencias-conducir';
const CKAN_ID = 'licencias-de-conducir-2025';

function run() {
  console.log(`\n  → ${REPORT_ID}`);

  const manifest = loadManifest();
  const ds = findDataset(manifest, CKAN_ID);

  const all = [];
  for (const res of ds.resources) {
    const rows = readCSV(localPath(res));
    for (const r of rows) {
      all.push({
        genero: String(r.genero || '').trim().toUpperCase(),
        tipoTramite: String(r.tipo_tramite || '').trim().toUpperCase(),
        clase: String(r.clase || '').trim(),
        estado: String(r.estado_licencia || '').trim().toUpperCase(),
        fechaOtorgamiento: String(r.fecha_otorgamiento || '').trim(),
      });
    }
  }

  console.log(`    rows: ${all.length}`);

  // ─── KPIs ───
  const total = all.length;
  const generoCounts = countBy(all, (r) => r.genero);
  const femenino = generoCounts.get('FEMENINO') || 0;
  const masculino = generoCounts.get('MASCULINO') || 0;
  const conGenero = femenino + masculino;
  const pctFemenino = conGenero > 0 ? (femenino / conGenero) * 100 : 0;

  const tipoCounts = countBy(all, (r) => r.tipoTramite);
  const originales = tipoCounts.get('ORIGINAL') || 0;
  const renovaciones = total - originales;
  const pctOriginal = total > 0 ? (originales / total) * 100 : 0;

  // Clase principal: tomar la primera clase listada (la fila puede tener "A.2.1, B.1")
  const clasePrincipalCounts = countBy(
    all.filter((r) => r.clase),
    (r) => r.clase.split(',')[0].trim(),
  );

  const kpis = [
    buildKPI({
      id: 'total',
      label: 'Licencias emitidas',
      value: total,
      formatted: formatNumberAR(total),
      unit: 'licencias',
    }),
    buildKPI({
      id: 'pct-femenino',
      label: 'Conductoras mujeres',
      value: pctFemenino,
      formatted: formatPercentAR(pctFemenino, 1),
      hint: `${formatNumberAR(femenino)} de ${formatNumberAR(conGenero)}`,
    }),
    buildKPI({
      id: 'pct-original',
      label: 'Licencias originales',
      value: pctOriginal,
      formatted: formatPercentAR(pctOriginal, 1),
      hint: `${formatNumberAR(originales)} originales · ${formatNumberAR(renovaciones)} otros trámites`,
    }),
    buildKPI({
      id: 'clases',
      label: 'Clases distintas',
      value: clasePrincipalCounts.size,
      formatted: formatNumberAR(clasePrincipalCounts.size),
      hint: 'Cantidad de clases de licencia emitidas (A, B, C, D, E, F, G).',
    }),
  ];

  // ─── Charts ───

  // 1. Género (pie)
  const generoData = [
    { id: 'Femenino', label: 'Femenino', value: femenino },
    { id: 'Masculino', label: 'Masculino', value: masculino },
  ].filter((d) => d.value > 0);

  // 2. Tipo de trámite (pie)
  const tipoData = [...tipoCounts.entries()]
    .filter(([k, v]) => k && v > 0)
    .map(([t, c]) => ({ id: t, label: t, value: c }));

  // 3. Clase (horizontalBar) - top 12
  const claseData = [...clasePrincipalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([cl, count]) => ({ clase: cl, licencias: count }));

  const charts = [
    {
      id: 'genero',
      type: 'pie',
      title: 'Licencias por género',
      subtitle: 'Distribución entre conductoras y conductores.',
      data: generoData,
      config: {},
    },
    {
      id: 'tipo-tramite',
      type: 'pie',
      title: 'Tipo de trámite',
      subtitle: 'Originales (primera vez) vs. renovaciones, duplicados y cambios.',
      data: tipoData,
      config: {},
    },
    {
      id: 'clases',
      type: 'horizontalBar',
      title: 'Licencias por clase (top 12)',
      subtitle: 'A=motos, B=autos particulares, C=transporte de cargas, D=pasajeros, etc.',
      data: claseData,
      config: { indexBy: 'clase', keys: ['licencias'] },
    },
  ];

  // ─── Output ───
  const data = {
    meta: buildMeta({
      id: REPORT_ID,
      title: 'Licencias de Conducir',
      category: 'seguridad-convivencia',
      description:
        'Licencias de conducir emitidas por el Centro Emisor de Licencias municipal en 2025: tipo de trámite (original, renovación), clase de licencia, género y estado.',
      manifestEntry: ds,
    }),
    kpis,
    charts,
    tables: [],
  };

  writeJSON(`public/data/${REPORT_ID}.json`, data);

  const md = renderMarkdown({ total, pctFemenino, pctOriginal, originales, renovaciones, clases: clasePrincipalCounts.size });
  writeMarkdown(`public/reports/${REPORT_ID}.md`, md);

  console.log(`    ✓ ${REPORT_ID}.json (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown({ total, pctFemenino, pctOriginal, originales, renovaciones, clases }) {
  return `## Resumen

El Centro Emisor de Licencias del municipio emitió **${formatNumberAR(total)} licencias de conducir** en 2025, con **${formatPercentAR(pctFemenino, 1)}** correspondiendo a conductoras mujeres. Del total, **${formatNumberAR(originales)}** son licencias originales (${formatPercentAR(pctOriginal, 1)}) y **${formatNumberAR(renovaciones)}** corresponden a renovaciones, duplicados, cambios de clase y otros trámites.

## Clases de licencia

Las **${formatNumberAR(clases)} clases** emitidas cubren el espectro de habilitaciones que reconoce la Ley Nacional de Tránsito: **A** (motos), **B** (autos particulares), **C** (camiones de carga), **D** (transporte de pasajeros), **E** (acoplados y semirremolques), **F** (vehículos adaptados a personas con discapacidad) y **G** (servicios y maquinaria especial). Una misma persona puede tener combinaciones (B.1+A.2.1 es la más común).

## Trámite

El proceso requiere: examen psicofísico, examen teórico, examen práctico, certificado de antecedentes penales y pago de tasas municipales y provinciales. La vigencia depende de la clase y la edad del titular: las renovaciones son cada 5 años para mayores hasta 65 años, y cada 1-3 años para mayores de 65.

## Sobre los datos

Cada registro contiene el género del titular, localidad, tipo de trámite, clase otorgada, y fechas de inicio del trámite, otorgamiento y vencimiento. No incluye datos personales identificatorios.
`;
}

module.exports = run;

if (require.main === module) {
  run();
}
