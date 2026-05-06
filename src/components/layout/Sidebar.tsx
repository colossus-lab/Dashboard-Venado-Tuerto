import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { CATEGORIES, CATEGORY_ORDER } from '../../lib/categories';
import { getReportsByCategory, getCategorySummary } from '../../data/reportRegistry';

export function Sidebar() {
  const location = useLocation();

  return (
    <nav>
      {CATEGORY_ORDER.map((catSlug) => {
        const cat = CATEGORIES[catSlug];
        const summary = getCategorySummary(catSlug);
        const reports = getReportsByCategory(catSlug);

        return (
          <div key={catSlug} className="sidebar-group">
            <div className="sidebar-group-title">
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: cat.color,
                  display: 'inline-block',
                }}
              />
              {cat.label}
            </div>

            {summary && (() => {
              const path = `/${summary.slug}`;
              const isActive = location.pathname === path;
              return (
                <Link
                  to={path}
                  className={`sidebar-link sidebar-link-summary${isActive ? ' is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Sparkles size={12} aria-hidden="true" style={{ marginRight: 6, opacity: 0.7 }} />
                  Resumen ejecutivo
                </Link>
              );
            })()}

            {reports.map((r) => {
              const path = `/${r.slug}`;
              const isActive = location.pathname === path;
              return (
                <Link
                  key={r.id}
                  to={path}
                  className={`sidebar-link${isActive ? ' is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {r.shortTitle}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
