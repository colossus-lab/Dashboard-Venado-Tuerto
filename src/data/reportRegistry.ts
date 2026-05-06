import type { ReportEntry, CategorySlug } from '../types/report';
import { CATEGORIES, CATEGORY_ORDER } from '../lib/categories';

// Helper para construir paths de manera consistente
function entry(args: {
  category: CategorySlug;
  id: string;
  title: string;
  shortTitle: string;
  order: number;
}): ReportEntry {
  const slug = `${args.category}/${args.id}`;
  return {
    id: `${args.category}-${args.id}`,
    slug,
    title: args.title,
    shortTitle: args.shortTitle,
    category: args.category,
    color: CATEGORIES[args.category].color,
    mdPath: `/reports/${slug}.md`,
    dataPath: `/data/${slug}.json`,
    order: args.order,
  };
}

// Resumen ejecutivo por categoría — slug es la categoría sin sub-path
function summary(category: CategorySlug, title: string): ReportEntry {
  return {
    id: `cat-${category}`,
    slug: category, // /<categoria>
    title,
    shortTitle: 'Resumen ejecutivo',
    category,
    color: CATEGORIES[category].color,
    mdPath: `/reports/${category}/_resumen.md`,
    dataPath: `/data/${category}/_resumen.json`,
    order: 0,
  };
}

// 8 resúmenes ejecutivos — uno por categoría
export const CATEGORY_SUMMARIES: ReportEntry[] = [
  summary('gobierno', 'Gobierno · Resumen ejecutivo'),
  summary('hacienda-economia', 'Hacienda y Economía · Resumen ejecutivo'),
  summary('educacion', 'Educación · Resumen ejecutivo'),
  summary('salud-desarrollo-humano', 'Salud y Desarrollo Humano · Resumen ejecutivo'),
  summary('seguridad-convivencia', 'Seguridad y Convivencia · Resumen ejecutivo'),
  summary('obras-servicios', 'Obras y Servicios Públicos · Resumen ejecutivo'),
  summary('ambiente', 'Ambiente · Resumen ejecutivo'),
  summary('vivienda-territorio', 'Vivienda y Territorio · Resumen ejecutivo'),
];

// Los 27 informes individuales — orden secuencial global
export const REPORTS: ReportEntry[] = [
  // ── Gobierno (6) ──
  entry({ category: 'gobierno', id: 'personal-municipal', title: 'Personal Municipal', shortTitle: 'Personal Municipal', order: 1 }),
  entry({ category: 'gobierno', id: 'organigrama', title: 'Organigrama Municipal', shortTitle: 'Organigrama', order: 2 }),
  entry({ category: 'gobierno', id: 'capacitaciones-rrhh', title: 'Capacitaciones al Personal', shortTitle: 'Capacitaciones RRHH', order: 3 }),
  entry({ category: 'gobierno', id: 'documentacion-cdr', title: 'Centro de Documentación Rápida', shortTitle: 'Documentación CDR', order: 4 }),
  entry({ category: 'gobierno', id: 'comisiones-vecinales', title: 'Comisiones Vecinales', shortTitle: 'Comisiones Vecinales', order: 5 }),
  entry({ category: 'gobierno', id: 'elecciones-vecinales', title: 'Elecciones Vecinales', shortTitle: 'Elecciones Vecinales', order: 6 }),

  // ── Hacienda y Economía (5) ──
  entry({ category: 'hacienda-economia', id: 'balances-tesoreria', title: 'Balances de Tesorería', shortTitle: 'Balances de Tesorería', order: 7 }),
  entry({ category: 'hacienda-economia', id: 'habilitaciones-comerciales', title: 'Habilitaciones Comerciales', shortTitle: 'Habilitaciones Comerciales', order: 8 }),
  entry({ category: 'hacienda-economia', id: 'establecimientos-comerciales', title: 'Establecimientos Comerciales', shortTitle: 'Establecimientos', order: 9 }),
  entry({ category: 'hacienda-economia', id: 'conecta-empleo', title: 'Capacitaciones Conecta Empleo', shortTitle: 'Conecta Empleo', order: 10 }),
  entry({ category: 'hacienda-economia', id: 'hogares-convivencia', title: 'Hogares de Convivencia', shortTitle: 'Hogares de Convivencia', order: 11 }),

  // ── Educación (3) ──
  entry({ category: 'educacion', id: 'oferta-educativa', title: 'Oferta Educativa', shortTitle: 'Oferta Educativa', order: 12 }),
  entry({ category: 'educacion', id: 'becados', title: 'Becados Municipales', shortTitle: 'Becados', order: 13 }),
  entry({ category: 'educacion', id: 'jardines-maternoinfantiles', title: 'Jardines Materno-Infantiles', shortTitle: 'Jardines Materno-Infantiles', order: 14 }),

  // ── Salud y Desarrollo Humano (2) ──
  entry({ category: 'salud-desarrollo-humano', id: 'dependencias-desarrollo-humano', title: 'Dependencias de Desarrollo Humano', shortTitle: 'Centros de Salud', order: 15 }),
  entry({ category: 'salud-desarrollo-humano', id: 'carnets-manipulacion-alimentos', title: 'Carnets de Manipulación de Alimentos', shortTitle: 'Carnets Manipulación', order: 16 }),

  // ── Seguridad y Convivencia (3) ──
  entry({ category: 'seguridad-convivencia', id: 'vehiculos-abandonados', title: 'Vehículos Abandonados', shortTitle: 'Vehículos Abandonados', order: 17 }),
  entry({ category: 'seguridad-convivencia', id: 'licencias-conducir', title: 'Licencias de Conducir', shortTitle: 'Licencias de Conducir', order: 18 }),
  entry({ category: 'seguridad-convivencia', id: 'decomisos-seguridad-alimentaria', title: 'Decomisos de Seguridad Alimentaria', shortTitle: 'Decomisos', order: 19 }),

  // ── Obras y Servicios (5) ──
  entry({ category: 'obras-servicios', id: 'obras-pavimento', title: 'Obras de Pavimento y Cordón Cuneta', shortTitle: 'Obras Pavimento', order: 20 }),
  entry({ category: 'obras-servicios', id: 'fabrica-tubos-ladrillos', title: 'Fábrica Municipal de Tubos y Ladrillos', shortTitle: 'Fábrica Tubos', order: 21 }),
  entry({ category: 'obras-servicios', id: 'mensuras', title: 'Expedientes de Mensura', shortTitle: 'Mensuras', order: 22 }),
  entry({ category: 'obras-servicios', id: 'ingreso-planos', title: 'Ingreso de Planos', shortTitle: 'Ingreso Planos', order: 23 }),
  entry({ category: 'obras-servicios', id: 'viajes-tup', title: 'Transporte Urbano de Pasajeros', shortTitle: 'TUP', order: 24 }),

  // ── Ambiente (2) ──
  entry({ category: 'ambiente', id: 'actividades-reciclar', title: 'Actividades Reciclar Venado', shortTitle: 'Reciclar Venado', order: 25 }),
  entry({ category: 'ambiente', id: 'visitas-planta-tratamiento', title: 'Visitas a la Planta de Tratamiento', shortTitle: 'Planta Tratamiento', order: 26 }),

  // ── Vivienda y Territorio (1) ──
  entry({ category: 'vivienda-territorio', id: 'nuestro-terreno', title: 'Programa Nuestro Terreno', shortTitle: 'Nuestro Terreno', order: 27 }),
];

// Lookup: primero busca en resúmenes (slug = categoría), luego en informes detallados.
export function getReportBySlug(slug: string): ReportEntry | undefined {
  const cleanSlug = slug.replace(/^\/+/, '').replace(/\/+$/, '');
  return (
    CATEGORY_SUMMARIES.find((r) => r.slug === cleanSlug) ||
    REPORTS.find((r) => r.slug === cleanSlug)
  );
}

export function getCategorySummary(category: CategorySlug): ReportEntry | undefined {
  return CATEGORY_SUMMARIES.find((s) => s.category === category);
}

export function getReportsByCategory(category: CategorySlug): ReportEntry[] {
  return REPORTS.filter((r) => r.category === category).sort((a, b) => a.order - b.order);
}

// Para navegación prev/next: lista plana de resúmenes seguidos por sus informes detallados.
export const ALL_REPORTS_FLAT: ReportEntry[] = CATEGORY_ORDER.flatMap((cat) => {
  const summary = getCategorySummary(cat);
  const detailed = getReportsByCategory(cat);
  return summary ? [summary, ...detailed] : detailed;
});
