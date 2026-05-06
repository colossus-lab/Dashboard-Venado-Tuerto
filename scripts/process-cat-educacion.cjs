/**
 * Análisis ejecutivo de EDUCACIÓN.
 * Sintetiza: oferta educativa (4 archivos), becados y jardines materno-infantiles.
 */

const {
  readCSV, countBy,
  writeJSON, writeMarkdown, loadManifest, findDataset, localPath,
  formatNumberAR, formatPercentAR, buildKPI, buildMeta,
} = require('./lib/csv-utils.cjs');

const SLUG = 'educacion';

function run() {
  console.log(`\n  → ${SLUG} (resumen ejecutivo)`);
  const m = loadManifest();
  const ofertaDs = findDataset(m, 'oferta-educativa-terciaria-y-universitaria-en-venado-tuerto');
  const becDs    = findDataset(m, 'becados-2025');
  const jardDs   = findDataset(m, 'asistentes-jardines-materno-infantiles-municipales-2025');

  // ── Oferta educativa: 4 archivos (inicial, primaria, secundaria, terciaria/univ) ──
  const niveles = { 'Inicial': 0, 'Primario': 0, 'Secundario': 0, 'Terciario/Universitario': 0 };
  const gestionPorNivel = {};
  for (const res of ofertaDs.resources) {
    const path = res.local_path.toLowerCase();
    const rows = readCSV(localPath(res));
    let nivelKey = 'Otro';
    if (/nivel-inicial/.test(path)) nivelKey = 'Inicial';
    else if (/escuelas-primarias/.test(path)) nivelKey = 'Primario';
    else if (/escuelas-secundarias/.test(path)) nivelKey = 'Secundario';
    else if (/instituciones-educativas-terciarias/.test(path)) nivelKey = 'Terciario/Universitario';

    if (nivelKey === 'Terciario/Universitario') {
      // Este archivo lista carreras, no instituciones únicas
      const insts = new Set(rows.map(r => String(r.institucion || '').trim()).filter(Boolean));
      niveles[nivelKey] = insts.size;
      // Para gestión, contamos por institución única (primer registro de cada una)
      const gest = countBy([...insts].map(i => {
        const r = rows.find(x => String(x.institucion).trim() === i);
        return String(r?.tipo_gestion || '').trim();
      }), x => x || '(sin)');
      gestionPorNivel[nivelKey] = gest;
    } else {
      niveles[nivelKey] = rows.length;
      gestionPorNivel[nivelKey] = countBy(rows, r =>
        String(r.tipo_gestion || r['tipo_gestión'] || '').trim() || '(sin)'
      );
    }
  }
  const totalInstituciones = Object.values(niveles).reduce((a, b) => a + b, 0);

  // ── Becados ───────────────────────────────────────────────
  const becRows = readCSV(localPath(becDs.resources[0]));
  const totalBec = becRows.length;
  const becPorNivel = countBy(becRows, r => String(r.nivel || '(sin)').trim());
  const becPorGenero = countBy(becRows, r => String(r.genero || '(sin)').trim());
  const becMujeres = becPorGenero.get('Femenino') || 0;
  const pctMujeresBec = totalBec > 0 ? (becMujeres / totalBec) * 100 : 0;

  // ── Jardines materno-infantiles ──────────────────────────
  const jardRows = readCSV(localPath(jardDs.resources[0]));
  const totalAsistentes = jardRows.length;
  const jardines = new Set(jardRows.map(r => String(r.jardin || '').trim())).size;
  const turnos = countBy(jardRows, r => String(r.turno || '(sin)').trim());

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = [
    buildKPI({
      id: 'instituciones',
      label: 'Instituciones educativas',
      value: totalInstituciones,
      formatted: formatNumberAR(totalInstituciones),
      hint: 'Niveles inicial, primario, secundario y superior',
    }),
    buildKPI({
      id: 'becados',
      label: 'Becados municipales',
      value: totalBec,
      formatted: formatNumberAR(totalBec),
      hint: `${pctMujeresBec.toFixed(1).replace('.', ',')}% mujeres`,
      status: 'good',
    }),
    buildKPI({
      id: 'asistentes',
      label: 'Niños en jardines municipales',
      value: totalAsistentes,
      formatted: formatNumberAR(totalAsistentes),
      hint: `${jardines} jardines materno-infantiles`,
    }),
  ];

  // ── Charts ────────────────────────────────────────────────
  const nivelesData = Object.entries(niveles)
    .filter(([, n]) => n > 0)
    .map(([nivel, n]) => ({ nivel, instituciones: n }));

  const becNivelData = [...becPorNivel.entries()]
    .filter(([k]) => k && k !== '(sin)')
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: id, value }));

  const becGeneroData = [...becPorGenero.entries()]
    .filter(([k]) => k && k !== '(sin)')
    .map(([id, value]) => ({ id, label: id, value }));

  const turnosData = [...turnos.entries()]
    .filter(([k]) => k && k !== '(sin)')
    .map(([id, value]) => ({ id, label: id, value }));

  const charts = [
    {
      id: 'instituciones-nivel',
      type: 'bar',
      title: 'Instituciones educativas por nivel',
      subtitle: 'Cobertura por etapa formativa.',
      data: nivelesData,
      config: { indexBy: 'nivel', keys: ['instituciones'] },
    },
    {
      id: 'becados-nivel',
      type: 'pie',
      title: 'Becados por nivel educativo',
      subtitle: 'Distribución del programa de becas municipales.',
      data: becNivelData,
    },
    {
      id: 'becados-genero',
      type: 'pie',
      title: 'Becados por género',
      subtitle: 'Composición demográfica.',
      data: becGeneroData,
    },
    {
      id: 'jardines-turno',
      type: 'pie',
      title: 'Asistentes a jardines · turno',
      subtitle: 'Distribución mañana / tarde / doble jornada.',
      data: turnosData,
    },
  ];

  // ── Output ────────────────────────────────────────────────
  const data = {
    meta: buildMeta({
      id: SLUG,
      title: 'Educación · Resumen ejecutivo',
      category: SLUG,
      description:
        'Panorama del sistema educativo en Venado Tuerto: oferta de instituciones por nivel, programa municipal de becas y jardines materno-infantiles.',
      manifestEntry: {
        source_url: 'https://datos-abiertos.venadotuerto.gob.ar/',
        license: 'CC-BY / ODC-BY',
        last_updated: becDs.last_updated,
        organization: 'Territorialidad y Desarrollo Cultural',
        notes: '',
      },
    }),
    kpis, charts,
  };
  writeJSON(`public/data/${SLUG}/_resumen.json`, data);

  writeMarkdown(`public/reports/${SLUG}/_resumen.md`, renderMarkdown({
    niveles, totalInstituciones, totalBec, pctMujeresBec, totalAsistentes, jardines,
  }));

  console.log(`    ✓ ${SLUG}/_resumen (${kpis.length} KPIs · ${charts.length} charts)`);
}

function renderMarkdown(d) {
  return `## Cobertura del sistema educativo

Venado Tuerto concentra **${formatNumberAR(d.totalInstituciones)} instituciones educativas** distribuidas a lo largo de la trayectoria formativa: ${d.niveles['Inicial']} de nivel inicial, ${d.niveles['Primario']} primarias, ${d.niveles['Secundario']} secundarias y ${d.niveles['Terciario/Universitario']} terciarias o universitarias. La oferta combina gestión pública, privada y mixta, lo que posiciona a la ciudad como **polo educativo del sur santafesino**.

## Programa municipal de becas

El sistema de becas municipales sostiene actualmente a **${formatNumberAR(d.totalBec)} estudiantes** en distintos niveles, con una participación femenina del **${d.pctMujeresBec.toFixed(1).replace('.', ',')}%**. El acompañamiento abarca desde nivel primario hasta carreras terciarias y universitarias, alineado con la política provincial de garantizar continuidad educativa.

## Primera infancia

Los jardines materno-infantiles municipales reciben a **${formatNumberAR(d.totalAsistentes)} niños y niñas** distribuidos en **${d.jardines} establecimientos**, con doble turno y propuestas pedagógicas integrales. Esta red constituye la **puerta de entrada al sistema educativo** y un soporte fundamental para hogares con responsabilidades laborales.

## Lectura

El cuadro educativo de Venado Tuerto muestra una infraestructura completa, una política activa de becas y una red de cuidado de la primera infancia. La calidad y los aprendizajes —no contemplados en estos datasets— son la dimensión faltante para una evaluación integral.
`;
}

module.exports = run;
if (require.main === module) run();
