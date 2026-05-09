/**
 * Padrón Oficial de Establecimientos Educativos — filtro Venado Tuerto.
 *
 * Fuente: Ministerio de Educación de la Nación (DiNIECE / RFIE).
 * Granularidad: establecimiento (CUE-Anexo) con localidad. Filtramos por
 * Departamento === 'GENERAL LOPEZ' && Localidad === 'VENADO TUERTO' (cód. 82042).
 *
 * Output: /public/data/educacion/padron-nacional-vt.json
 *         /public/reports/educacion/padron-nacional-vt.md
 */

const path = require('path');
const XLSX = require('xlsx');
const {
  writeJSON, writeMarkdown,
  formatNumberAR, formatPercentAR,
  buildKPI, buildMeta, PROJECT_ROOT,
} = require('./lib/csv-utils.cjs');

const SLUG = 'educacion/padron-nacional-vt';
const XLSX_PATH = path.join(
  PROJECT_ROOT,
  'data', 'raw', '_external', 'educacion-nacional', 'padron-oficial.xlsx'
);

// Columnas (índice basado en row 5 del xlsx)
const COL = {
  jurisdiccion: 0, sector: 1, ambito: 2, departamento: 3, codDepto: 4,
  localidad: 5, codLoc: 6, cueAnexo: 7, nombre: 8, domicilio: 9, cp: 10,
  telefono: 11, mail: 12,
  modComun: 13, modEspecial: 14, modAdultos: 15,
  // Modalidad COMÚN
  com_inicMaternal: 16, com_inicJardin: 17, com_primario: 18,
  com_secundario: 19, com_secundarioInet: 20,
  com_snu: 21, com_snuInet: 22, com_snuCursos: 23,
  // Modalidad ESPECIAL
  esp_inicEducTemp: 24, esp_inicJardin: 25, esp_primario: 26,
  esp_secundario: 27, esp_integracion: 28,
  // Modalidad ADULTOS
  adu_primario: 29, adu_secundario: 30, adu_fp: 31,
  adu_fpInet: 32, adu_alfa: 33,
  // Modalidad HOSPITALARIA
  hosp_inicial: 34, hosp_primario: 35, hosp_secundario: 36,
  // Otras
  talleresArtistica: 37, serviciosComp: 38, validezTitulos: 39,
};

function norm(s) {
  return String(s || '').trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isOne(v) {
  return v === 1 || v === '1' || v === true;
}

function run() {
  console.log(`\n  → ${SLUG} (Padrón nacional · filtro VT)`);

  const wb = XLSX.readFile(XLSX_PATH);
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets['padron'], { header: 1, defval: null });

  // Fecha de actualización está en row 2 (formato: "Fecha de actualización: 12/01/2026.")
  const fechaTxt = String(aoa[2]?.[0] || '');
  const fechaMatch = fechaTxt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const fechaActualizacion = fechaMatch
    ? new Date(`${fechaMatch[3]}-${fechaMatch[2].padStart(2,'0')}-${fechaMatch[1].padStart(2,'0')}`).toISOString()
    : new Date().toISOString();

  const data = aoa.slice(6);
  const vt = data.filter(r =>
    norm(r[COL.localidad]) === 'VENADO TUERTO' &&
    norm(r[COL.departamento]) === 'GENERAL LOPEZ'
  );
  console.log(`     ${vt.length} establecimientos VT detectados`);

  const total = vt.length;

  // ── Sector ─────────────────────────────────────────────────
  const estatal = vt.filter(r => r[COL.sector] === 'Estatal').length;
  const privado = vt.filter(r => r[COL.sector] === 'Privado').length;
  const pctEstatal = total ? (estatal / total) * 100 : 0;

  // ── Ámbito ─────────────────────────────────────────────────
  const urbano = vt.filter(r => r[COL.ambito] === 'Urbano').length;
  const rural  = vt.filter(r => r[COL.ambito] === 'Rural').length;

  // ── Modalidades activas (suma de flags) ────────────────────
  const modComun    = vt.filter(r => isOne(r[COL.modComun])).length;
  const modEspecial = vt.filter(r => isOne(r[COL.modEspecial])).length;
  const modAdultos  = vt.filter(r => isOne(r[COL.modAdultos])).length;
  const modHosp     = vt.filter(r =>
    isOne(r[COL.hosp_inicial]) || isOne(r[COL.hosp_primario]) || isOne(r[COL.hosp_secundario])
  ).length;
  const modTalleres = vt.filter(r => isOne(r[COL.talleresArtistica])).length;

  // ── Niveles (consolidado entre modalidades) ────────────────
  // Cada celda con "1" es una oferta. Cuento ofertas únicas por establecimiento
  // por nivel: si el establecimiento tiene cualquier flag de inicial = 1, cuenta.
  function countNivel(rows, idxs) {
    return rows.filter(r => idxs.some(i => isOne(r[i]))).length;
  }
  const nivInicial    = countNivel(vt, [COL.com_inicMaternal, COL.com_inicJardin, COL.esp_inicEducTemp, COL.esp_inicJardin, COL.hosp_inicial]);
  const nivPrimario   = countNivel(vt, [COL.com_primario, COL.esp_primario, COL.adu_primario, COL.hosp_primario]);
  const nivSecundario = countNivel(vt, [COL.com_secundario, COL.com_secundarioInet, COL.esp_secundario, COL.adu_secundario, COL.hosp_secundario]);
  const nivSuperior   = countNivel(vt, [COL.snu, COL.com_snu, COL.com_snuInet, COL.com_snuCursos]);
  const nivFP         = countNivel(vt, [COL.adu_fp, COL.adu_fpInet, COL.adu_alfa]);
  const nivTalleres   = countNivel(vt, [COL.talleresArtistica]);

  // ── Total de ofertas (suma de todas las celdas con 1 en cols 16-37) ──
  const ofertaIdxs = [
    COL.com_inicMaternal, COL.com_inicJardin, COL.com_primario, COL.com_secundario,
    COL.com_secundarioInet, COL.com_snu, COL.com_snuInet, COL.com_snuCursos,
    COL.esp_inicEducTemp, COL.esp_inicJardin, COL.esp_primario, COL.esp_secundario, COL.esp_integracion,
    COL.adu_primario, COL.adu_secundario, COL.adu_fp, COL.adu_fpInet, COL.adu_alfa,
    COL.hosp_inicial, COL.hosp_primario, COL.hosp_secundario,
    COL.talleresArtistica,
  ];
  const totalOfertas = vt.reduce((acc, r) =>
    acc + ofertaIdxs.reduce((a, i) => a + (isOne(r[i]) ? 1 : 0), 0), 0);

  // ── Sector × Nivel (para stacked) ─────────────────────────
  function nivelesPorSector(sector) {
    const subset = vt.filter(r => r[COL.sector] === sector);
    return {
      Inicial:     countNivel(subset, [COL.com_inicMaternal, COL.com_inicJardin, COL.esp_inicEducTemp, COL.esp_inicJardin, COL.hosp_inicial]),
      Primario:    countNivel(subset, [COL.com_primario, COL.esp_primario, COL.adu_primario, COL.hosp_primario]),
      Secundario:  countNivel(subset, [COL.com_secundario, COL.com_secundarioInet, COL.esp_secundario, COL.adu_secundario, COL.hosp_secundario]),
      Superior:    countNivel(subset, [COL.com_snu, COL.com_snuInet, COL.com_snuCursos]),
      'Form. Profesional': countNivel(subset, [COL.adu_fp, COL.adu_fpInet, COL.adu_alfa]),
    };
  }
  const sectorNivelEstatal = nivelesPorSector('Estatal');
  const sectorNivelPrivado = nivelesPorSector('Privado');

  // ── Top establecimientos por cantidad de ofertas ──────────
  const ranking = vt.map(r => ({
    nombre: String(r[COL.nombre] || '').trim(),
    cue: String(r[COL.cueAnexo] || '').trim(),
    sector: r[COL.sector],
    ambito: r[COL.ambito],
    ofertas: ofertaIdxs.reduce((a, i) => a + (isOne(r[i]) ? 1 : 0), 0),
  })).sort((a, b) => b.ofertas - a.ofertas).slice(0, 15);

  // ── KPIs ──────────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'total-establecimientos',
      label: 'Establecimientos educativos',
      value: total,
      formatted: formatNumberAR(total),
      hint: 'Padrón Nacional · localidad Venado Tuerto',
    }),
    buildKPI({
      id: 'pct-estatal',
      label: 'Gestión estatal',
      value: Math.round(pctEstatal * 10) / 10,
      formatted: formatPercentAR(pctEstatal),
      hint: `${estatal} estatales · ${privado} privados`,
    }),
    buildKPI({
      id: 'total-ofertas',
      label: 'Ofertas educativas activas',
      value: totalOfertas,
      formatted: formatNumberAR(totalOfertas),
      hint: 'Suma de niveles/modalidades por establecimiento',
    }),
    buildKPI({
      id: 'urbano',
      label: 'Establecimientos urbanos',
      value: urbano,
      formatted: formatNumberAR(urbano),
      hint: `${rural} rurales`,
    }),
  ];

  // ── Charts ────────────────────────────────────────────────
  const charts = [
    {
      id: 'sector',
      type: 'pie',
      title: 'Establecimientos por sector de gestión',
      subtitle: 'Estatal vs. privado en localidad Venado Tuerto',
      data: [
        { id: 'Estatal', label: 'Estatal', value: estatal },
        { id: 'Privado', label: 'Privado', value: privado },
      ],
      config: { valueFormat: 'number' },
    },
    {
      id: 'niveles',
      type: 'horizontalBar',
      title: 'Establecimientos que ofrecen cada nivel',
      subtitle: 'Un establecimiento puede ofrecer varios niveles',
      data: [
        { nivel: 'Inicial',     valor: nivInicial },
        { nivel: 'Primario',    valor: nivPrimario },
        { nivel: 'Secundario',  valor: nivSecundario },
        { nivel: 'Superior',    valor: nivSuperior },
        { nivel: 'Form. Prof.', valor: nivFP },
        { nivel: 'Talleres',    valor: nivTalleres },
      ],
      config: { keys: ['valor'], indexBy: 'nivel', valueFormat: 'number' },
    },
    {
      id: 'sector-nivel',
      type: 'stackedBar',
      title: 'Niveles por sector de gestión',
      subtitle: 'Cantidad de establecimientos por nivel × sector',
      data: ['Inicial', 'Primario', 'Secundario', 'Superior', 'Form. Profesional'].map(n => ({
        nivel: n,
        Estatal: sectorNivelEstatal[n] || 0,
        Privado: sectorNivelPrivado[n] || 0,
      })),
      config: { keys: ['Estatal', 'Privado'], indexBy: 'nivel', valueFormat: 'number' },
    },
    {
      id: 'modalidades',
      type: 'bar',
      title: 'Modalidades educativas',
      subtitle: 'Establecimientos que ofrecen cada modalidad',
      data: [
        { modalidad: 'Común',         valor: modComun },
        { modalidad: 'Especial',      valor: modEspecial },
        { modalidad: 'Adultos',       valor: modAdultos },
        { modalidad: 'Hospitalaria',  valor: modHosp },
        { modalidad: 'Tall./Artíst.', valor: modTalleres },
      ],
      config: { keys: ['valor'], indexBy: 'modalidad', valueFormat: 'number' },
    },
  ];

  // ── Tabla ─────────────────────────────────────────────────
  const tables = [
    {
      id: 'ranking',
      title: 'Establecimientos con más ofertas educativas activas',
      columns: ['Establecimiento', 'CUE-Anexo', 'Sector', 'Ámbito', 'Ofertas'],
      rows: ranking.map(r => [r.nombre, r.cue, r.sector, r.ambito, r.ofertas]),
      maxRows: 15,
    },
  ];

  // ── Meta ──────────────────────────────────────────────────
  const meta = buildMeta({
    id: 'padron-nacional-vt',
    title: 'Padrón Nacional Educativo · Venado Tuerto',
    category: 'educacion',
    description:
      'Establecimientos educativos de la localidad de Venado Tuerto registrados en el ' +
      'Padrón Oficial del Ministerio de Educación de la Nación (DiNIECE). ' +
      'Datos filtrados estrictamente para la localidad (cód. 82042).',
    manifestEntry: {
      source_url: 'https://www.argentina.gob.ar/educacion/evaluacion-e-informacion-educativa/padron-establecimientos',
      license: 'Datos abiertos · Ministerio de Educación',
      last_updated: fechaActualizacion,
      organization: 'Ministerio de Educación de la Nación · DiNIECE',
    },
  });

  // ── Output ────────────────────────────────────────────────
  writeJSON(`public/data/${SLUG}.json`, { meta, kpis, charts, tables });

  const md = `# Padrón Nacional Educativo · Venado Tuerto

Fuente oficial del **Ministerio de Educación de la Nación** (Dirección de Información y
Estadística Educativa). A diferencia de los reportes municipales, este padrón cubre el
universo completo de establecimientos —públicos y privados— registrados a nivel nacional,
filtrados estrictamente por la localidad **Venado Tuerto** (código 82042) en el departamento
General López de la provincia de Santa Fe.

## Cobertura

- **${formatNumberAR(total)}** establecimientos educativos registrados en Venado Tuerto.
- **${formatPercentAR(pctEstatal)}** de gestión estatal (${estatal}); **${privado}** de gestión privada.
- **${formatNumberAR(urbano)}** establecimientos urbanos · **${rural}** rurales.
- **${formatNumberAR(totalOfertas)}** ofertas educativas activas en total
  (un establecimiento puede ofrecer varios niveles y modalidades simultáneamente).

## Niveles educativos

El sistema local cubre todo el espectro formal: **${nivInicial}** establecimientos con nivel
inicial, **${nivPrimario}** con primario, **${nivSecundario}** con secundario,
**${nivSuperior}** con superior no universitario y **${nivFP}** con formación profesional.

## Modalidades

La modalidad común está presente en **${modComun}** establecimientos, especial en
**${modEspecial}**, adultos en **${modAdultos}** y talleres/artística en **${modTalleres}**.

## Notas metodológicas

- El "número de ofertas" cuenta combinaciones de **modalidad × nivel** activas en cada
  establecimiento; un colegio que tenga inicial común, primario común y primario para
  adultos suma 3 ofertas.
- Los flags de oferta provienen de las columnas activas (valor = 1) del padrón.
- Última actualización del padrón nacional: ${fechaActualizacion.slice(0, 10)}.
`;
  writeMarkdown(`public/reports/${SLUG}.md`, md);

  console.log(`     ✓ ${SLUG} listo`);
}

run();
