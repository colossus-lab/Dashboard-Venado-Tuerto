/**
 * Censo Nacional 2022 (INDEC) — datos por localidad, filtro Venado Tuerto.
 *
 * Fuente: INDEC. Capa "Pxlocdatos" — localidades con datos definitivos del Censo 2022.
 * Granularidad: localidad censal. Filtramos por código 82042290 (Venado Tuerto).
 *
 * Output: /public/data/demografia/censo-2022-vt.json
 *         /public/reports/demografia/censo-2022-vt.md
 *         /public/data/demografia/_resumen.json (resumen ejecutivo de la categoría)
 *         /public/reports/demografia/_resumen.md
 */

const fs = require('fs');
const path = require('path');
const {
  writeJSON, writeMarkdown,
  formatNumberAR, formatPercentAR,
  buildKPI, buildMeta, PROJECT_ROOT,
} = require('./lib/csv-utils.cjs');

const DBF_PATH = path.join(PROJECT_ROOT, 'data', 'raw', '_external', 'censo-2022', 'pxlocdatos.dbf');
const VT_LINK = '82042290';

/** Mini parser DBF (dBase III): lee header + records de longitud fija. */
function readDBF(filePath) {
  const buf = fs.readFileSync(filePath);
  const numRecords = buf.readUInt32LE(4);
  const headerSize = buf.readUInt16LE(8);
  const recordSize = buf.readUInt16LE(10);
  const numFields = (headerSize - 33) >> 5; // 32 bytes per field, +1 terminator

  const fields = [];
  for (let i = 0; i < numFields; i++) {
    const off = 32 + i * 32;
    const nameEnd = buf.indexOf(0, off);
    const name = buf.slice(off, nameEnd > 0 && nameEnd < off + 11 ? nameEnd : off + 11).toString('latin1').trim();
    const type = String.fromCharCode(buf[off + 11]);
    const length = buf[off + 16];
    fields.push({ name, type, length });
  }

  const rows = [];
  for (let r = 0; r < numRecords; r++) {
    const recOff = headerSize + r * recordSize;
    if (buf[recOff] === 0x2a) continue; // deleted record (*)
    let off = recOff + 1;
    const row = {};
    for (const f of fields) {
      const raw = buf.slice(off, off + f.length).toString('latin1').trim();
      if (f.type === 'N' || f.type === 'F') {
        const n = parseFloat(raw);
        row[f.name] = Number.isFinite(n) ? n : null;
      } else {
        row[f.name] = raw;
      }
      off += f.length;
    }
    rows.push(row);
  }
  return { fields, rows };
}

function run() {
  console.log('\n  → demografia/censo-2022-vt (INDEC Censo 2022 · localidad VT)');

  const { rows } = readDBF(DBF_PATH);
  const vt = rows.find(r => r.link === VT_LINK);
  if (!vt) {
    throw new Error(`No se encontró localidad con link=${VT_LINK} en pxlocdatos.dbf`);
  }

  const { personas, varones, mujeres, hogares, viv_part_h, viv_part } = vt;
  const desocupadas = (viv_part || 0) - (viv_part_h || 0);
  const pctMujeres = personas ? (mujeres / personas) * 100 : 0;
  const indiceMasculinidad = mujeres ? (varones / mujeres) * 100 : 0;
  const personasPorHogar = hogares ? personas / hogares : 0;
  const pctViviendasDesocupadas = viv_part ? (desocupadas / viv_part) * 100 : 0;

  const categoria = 'demografia';
  const slug = 'demografia/censo-2022-vt';

  const meta = buildMeta({
    id: 'censo-2022-vt',
    title: 'Censo Nacional 2022 · Venado Tuerto',
    category: categoria,
    description:
      'Resultados definitivos del Censo Nacional de Población, Hogares y Viviendas 2022 ' +
      'del INDEC, filtrados estrictamente para la localidad Venado Tuerto ' +
      `(código de localidad 82042290).`,
    manifestEntry: {
      source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-2-41-165',
      license: 'Datos abiertos · INDEC',
      last_updated: '2025-07-08T00:00:00.000Z',
      organization: 'INDEC · Censo Nacional de Población, Hogares y Viviendas 2022',
    },
  });

  const kpis = [
    buildKPI({
      id: 'poblacion',
      label: 'Población total',
      value: personas,
      formatted: formatNumberAR(personas),
      hint: 'Censo 2022 · localidad Venado Tuerto',
    }),
    buildKPI({
      id: 'hogares',
      label: 'Hogares',
      value: hogares,
      formatted: formatNumberAR(hogares),
      hint: `${personasPorHogar.toFixed(2).replace('.', ',')} personas por hogar`,
    }),
    buildKPI({
      id: 'pct-mujeres',
      label: 'Mujeres',
      value: Math.round(pctMujeres * 10) / 10,
      formatted: formatPercentAR(pctMujeres),
      hint: `${formatNumberAR(mujeres)} mujeres · ${formatNumberAR(varones)} varones`,
    }),
    buildKPI({
      id: 'viviendas',
      label: 'Viviendas particulares',
      value: viv_part,
      formatted: formatNumberAR(viv_part),
      hint: `${formatPercentAR(pctViviendasDesocupadas)} desocupadas o de uso temporario`,
    }),
  ];

  const charts = [
    {
      id: 'sexo',
      type: 'pie',
      title: 'Población por sexo',
      subtitle: 'Censo 2022 · Venado Tuerto',
      data: [
        { id: 'Mujeres', label: 'Mujeres', value: mujeres },
        { id: 'Varones', label: 'Varones', value: varones },
      ],
      config: { valueFormat: 'number' },
    },
    {
      id: 'viviendas-ocupacion',
      type: 'pie',
      title: 'Viviendas particulares por ocupación',
      subtitle: 'Habitadas vs. desocupadas / uso temporario',
      data: [
        { id: 'Habitadas', label: 'Habitadas', value: viv_part_h },
        { id: 'Desocupadas o temporarias', label: 'Desoc./temp.', value: desocupadas },
      ],
      config: { valueFormat: 'number' },
    },
    {
      id: 'estructura',
      type: 'bar',
      title: 'Indicadores estructurales',
      subtitle: 'Hogares, viviendas y población',
      data: [
        { categoria: 'Población',          valor: personas },
        { categoria: 'Hogares',            valor: hogares },
        { categoria: 'Viv. habitadas',     valor: viv_part_h },
        { categoria: 'Viv. particulares',  valor: viv_part },
      ],
      config: { keys: ['valor'], indexBy: 'categoria', valueFormat: 'number' },
    },
  ];

  const tables = [{
    id: 'detalle',
    title: 'Detalle Censo 2022 · Venado Tuerto',
    columns: ['Indicador', 'Valor'],
    rows: [
      ['Población total', formatNumberAR(personas)],
      ['Varones', formatNumberAR(varones)],
      ['Mujeres', formatNumberAR(mujeres)],
      ['Índice de masculinidad', `${indiceMasculinidad.toFixed(1).replace('.', ',')}`],
      ['Hogares', formatNumberAR(hogares)],
      ['Personas por hogar', personasPorHogar.toFixed(2).replace('.', ',')],
      ['Viviendas particulares habitadas', formatNumberAR(viv_part_h)],
      ['Viviendas particulares totales', formatNumberAR(viv_part)],
      ['Viviendas desocupadas / temporarias', formatNumberAR(desocupadas)],
      ['% viviendas desocupadas', formatPercentAR(pctViviendasDesocupadas)],
    ],
  }];

  writeJSON(`public/data/${slug}.json`, { meta, kpis, charts, tables });

  const md = `# Censo Nacional 2022 · Venado Tuerto

Resultados definitivos del **Censo Nacional de Población, Hogares y Viviendas 2022** del
INDEC. Datos publicados a nivel localidad censal — filtrados estrictamente por **Venado
Tuerto** (código 82042290), sin agregar ninguna otra localidad de General López.

## Población

Venado Tuerto registró **${formatNumberAR(personas)}** personas en el Censo 2022:
**${formatNumberAR(varones)}** varones y **${formatNumberAR(mujeres)}** mujeres.
La proporción de mujeres es del **${formatPercentAR(pctMujeres)}**, con un
índice de masculinidad de **${indiceMasculinidad.toFixed(1).replace('.', ',')}**
varones cada 100 mujeres.

## Hogares y viviendas

La localidad cuenta con **${formatNumberAR(hogares)}** hogares, lo que da un promedio de
**${personasPorHogar.toFixed(2).replace('.', ',')}** personas por hogar.

Hay **${formatNumberAR(viv_part)}** viviendas particulares en total, de las cuales
**${formatNumberAR(viv_part_h)}** están habitadas. Las
**${formatNumberAR(desocupadas)}** viviendas restantes
(**${formatPercentAR(pctViviendasDesocupadas)}**) figuran como desocupadas o de uso
temporario al momento del relevamiento censal.

## Notas metodológicas

- Fuente: INDEC, capa cartográfica "Pxlocdatos" — Censo 2022, localidades con datos.
- Cobertura: localidad censal Venado Tuerto, departamento General López, provincia de
  Santa Fe.
- Las bases tabuladas con desagregación por edad, educación, actividad económica y
  fecundidad sólo se publican a nivel departamental o provincial; este reporte acota la
  visualización a las variables que sí están disponibles para la localidad.
`;
  writeMarkdown(`public/reports/${slug}.md`, md);

  // ── Resumen ejecutivo de la categoría (mismo dataset, slug = categoría) ──
  const resumenMeta = { ...meta, id: 'demografia-resumen', title: 'Demografía · Resumen ejecutivo' };
  writeJSON(`public/data/${categoria}/_resumen.json`, { meta: resumenMeta, kpis, charts, tables });
  writeMarkdown(`public/reports/${categoria}/_resumen.md`,
`# Demografía · Resumen ejecutivo

Datos del Censo Nacional 2022 (INDEC) para la localidad de Venado Tuerto.

- Población: **${formatNumberAR(personas)}** habitantes.
- Hogares: **${formatNumberAR(hogares)}** (${personasPorHogar.toFixed(2).replace('.', ',')} pers./hogar).
- Mujeres: **${formatPercentAR(pctMujeres)}** del total.
- Viviendas particulares: **${formatNumberAR(viv_part)}** (${formatPercentAR(pctViviendasDesocupadas)} desocupadas).

A medida que se incorporen nuevas fuentes con desagregación por localidad de Venado
Tuerto, esta sección se ampliará. Las variables que sólo se publican a nivel
departamental o provincial quedan fuera del alcance de este dashboard.
`);

  console.log(`     ${formatNumberAR(personas)} habitantes · ${formatNumberAR(hogares)} hogares`);
  console.log(`     ✓ ${slug} listo`);
}

run();
