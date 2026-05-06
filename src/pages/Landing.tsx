import { Link } from 'react-router-dom';
import {
  Building2,
  Wallet,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  HardHat,
  Leaf,
  Home as HomeIcon,
  ArrowRight,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { CATEGORIES, CATEGORY_ORDER } from '../lib/categories';
import { getReportsByCategory, getCategorySummary, REPORTS } from '../data/reportRegistry';
import type { CategorySlug } from '../types/report';

const ICONS: Record<CategorySlug, ComponentType<{ size?: number }>> = {
  gobierno: Building2,
  'hacienda-economia': Wallet,
  educacion: GraduationCap,
  'salud-desarrollo-humano': HeartHandshake,
  'seguridad-convivencia': ShieldCheck,
  'obras-servicios': HardHat,
  ambiente: Leaf,
  'vivienda-territorio': HomeIcon,
};

export function Landing() {
  return (
    <>
      <section className="landing-hero">
        <span className="landing-badge">
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent-cyan)',
              display: 'inline-block',
            }}
          />
          Plataforma de datos abiertos · Venado Tuerto
        </span>
        <h1>Datos públicos de la ciudad, al alcance de todos</h1>
        <p>
          {CATEGORY_ORDER.length} análisis ejecutivos sobre la gestión municipal de Venado Tuerto:
          gobierno, economía, educación, salud, seguridad, obras, ambiente y vivienda. Datos
          oficiales del portal CKAN del municipio, sintetizados en KPIs y visualizaciones.
        </p>
      </section>

      <section className="category-grid" aria-label="Categorías de análisis">
        {CATEGORY_ORDER.map((catSlug) => {
          const cat = CATEGORIES[catSlug];
          const summary = getCategorySummary(catSlug);
          const reports = getReportsByCategory(catSlug);
          const Icon = ICONS[catSlug];
          const target = summary ? `/${summary.slug}` : reports.length > 0 ? `/${reports[0].slug}` : '/';
          return (
            <Link
              key={catSlug}
              to={target}
              className="category-card"
              style={{ ['--category-color' as string]: cat.color }}
            >
              <div className="category-card-icon" style={{ background: cat.color }}>
                <Icon size={22} />
              </div>
              <h2 className="category-card-title">{cat.label}</h2>
              <p className="category-card-meta">
                Resumen ejecutivo · {reports.length} {reports.length === 1 ? 'dataset' : 'datasets'}
              </p>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  margin: '0.5rem 0 0',
                  lineHeight: 1.5,
                }}
              >
                {cat.description}
              </p>
              <div
                className="flex items-center gap-1"
                style={{
                  marginTop: '1rem',
                  fontSize: '0.85rem',
                  color: cat.color,
                  fontWeight: 600,
                }}
              >
                Ver análisis <ArrowRight size={14} />
              </div>
            </Link>
          );
        })}
      </section>

      <section style={{ marginTop: '3rem' }}>
        <div className="section-card">
          <h2 style={{ fontFamily: 'var(--font-heading)', margin: '0 0 0.5rem' }}>
            Sobre los datos
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Todos los datasets provienen del{' '}
            <a
              href="https://datos-abiertos.venadotuerto.gob.ar/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-accent)' }}
            >
              Portal de Datos Abiertos de Venado Tuerto
            </a>{' '}
            (CKAN v2.10), publicados bajo licencias abiertas (CC-BY / ODC-BY). Cada informe enlaza
            con la fuente original y permite copiar la cita correspondiente.
          </p>
        </div>
      </section>
    </>
  );
}
