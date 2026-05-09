import type { CategoryDef, CategorySlug } from '../types/report';

export const CATEGORIES: Record<CategorySlug, CategoryDef> = {
  gobierno: {
    slug: 'gobierno',
    label: 'Gobierno',
    color: '#00d4ff',
    description: 'Estructura municipal, personal, vecinales y documentación.',
  },
  'hacienda-economia': {
    slug: 'hacienda-economia',
    label: 'Hacienda y Economía',
    color: '#10b981',
    description: 'Balances de tesorería, comercios y empleo.',
  },
  educacion: {
    slug: 'educacion',
    label: 'Educación',
    color: '#8b5cf6',
    description: 'Oferta educativa, becas y jardines maternales.',
  },
  'salud-desarrollo-humano': {
    slug: 'salud-desarrollo-humano',
    label: 'Salud y Desarrollo Humano',
    color: '#ec4899',
    description: 'Centros de salud, programas sociales y seguridad alimentaria.',
  },
  'seguridad-convivencia': {
    slug: 'seguridad-convivencia',
    label: 'Seguridad y Convivencia',
    color: '#f97316',
    description: 'Vehículos abandonados, licencias y decomisos.',
  },
  'obras-servicios': {
    slug: 'obras-servicios',
    label: 'Obras y Servicios',
    color: '#eab308',
    description: 'Pavimentación, mensuras, planos y transporte urbano.',
  },
  ambiente: {
    slug: 'ambiente',
    label: 'Ambiente',
    color: '#22c55e',
    description: 'Reciclaje y planta de tratamiento de residuos.',
  },
  'vivienda-territorio': {
    slug: 'vivienda-territorio',
    label: 'Vivienda y Territorio',
    color: '#3b82f6',
    description: 'Programa Nuestro Terreno y beneficiarios.',
  },
  demografia: {
    slug: 'demografia',
    label: 'Demografía',
    color: '#06b6d4',
    description: 'Censo Nacional 2022 INDEC · datos de la localidad de Venado Tuerto.',
  },
};

export const CATEGORY_ORDER: CategorySlug[] = [
  'gobierno',
  'hacienda-economia',
  'educacion',
  'salud-desarrollo-humano',
  'seguridad-convivencia',
  'obras-servicios',
  'ambiente',
  'vivienda-territorio',
  'demografia',
];
