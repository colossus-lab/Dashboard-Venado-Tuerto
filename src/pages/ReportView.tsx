import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, Calendar, FileText, ArrowLeft, ArrowRight } from 'lucide-react';
import { getReportBySlug, ALL_REPORTS_FLAT } from '../data/reportRegistry';
import { useReportData } from '../hooks/useReportData';
import { KPICounter } from '../components/ui/KPICounter';
import { ChartRenderer } from '../components/charts/ChartRenderer';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { CitationBox } from '../components/report/CitationBox';
import { CATEGORIES } from '../lib/categories';
import { formatDate } from '../lib/format';
import type { ReportEntry, ReportTable } from '../types/report';

export function ReportView() {
  const params = useParams();
  const slug = params['*'] || '';
  const report = getReportBySlug(slug);

  if (!report) {
    return (
      <EmptyState
        icon={<AlertCircle size={48} />}
        title="Informe no encontrado"
        message={`No existe un informe en la ruta /${slug}.`}
        primaryAction={{ label: 'Volver al inicio', to: '/' }}
      />
    );
  }

  return <ReportContent reportEntry={report} />;
}

function ReportContent({ reportEntry }: { reportEntry: ReportEntry }) {
  const { markdown, data, loading, error } = useReportData(reportEntry.mdPath, reportEntry.dataPath);
  const cat = CATEGORIES[reportEntry.category];

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <EmptyState
        icon={<AlertCircle size={48} />}
        title="No pudimos cargar este informe"
        message={
          error ||
          'Es posible que el informe aún no esté procesado. Probá recargar la página o ejecutá `npm run build-data` desde la terminal.'
        }
        primaryAction={{ label: 'Reintentar', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'Volver al inicio', to: '/' }}
      />
    );
  }

  // Adjacent reports (incluye resúmenes ejecutivos antes de los detallados de cada categoría)
  const idx = ALL_REPORTS_FLAT.findIndex((r) => r.id === reportEntry.id);
  const prev = idx > 0 ? ALL_REPORTS_FLAT[idx - 1] : null;
  const next = idx >= 0 && idx < ALL_REPORTS_FLAT.length - 1 ? ALL_REPORTS_FLAT[idx + 1] : null;

  return (
    <article>
      {/* Hero */}
      <header className="report-hero">
        <div className="flex items-center gap-3" style={{ marginBottom: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.6rem',
              background: cat.color + '20',
              color: cat.color,
              borderRadius: '999px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {cat.label}
          </span>
          <span className="text-tertiary text-sm">
            {reportEntry.order === 0
              ? 'Resumen ejecutivo'
              : `Informe ${String(reportEntry.order).padStart(2, '0')} / 27`}
          </span>
        </div>
        <h1 className="report-hero-title">{reportEntry.title}</h1>
        <p className="report-hero-meta">
          <span className="report-hero-meta-item">
            <Calendar size={14} aria-hidden="true" /> Actualizado: {formatDate(data.meta.last_updated)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="report-hero-meta-item">
            <FileText size={14} aria-hidden="true" /> {data.meta.organization}
          </span>
        </p>
        {data.meta.description && <p className="report-hero-description">{data.meta.description}</p>}
      </header>

      {/* KPIs */}
      {data.kpis.length > 0 && (
        <div className="kpi-grid">
          {data.kpis.map((kpi) => (
            <KPICounter key={kpi.id} kpi={kpi} />
          ))}
        </div>
      )}

      {/* Charts */}
      {data.charts.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          {data.charts.map((c) => (
            <ChartRenderer key={c.id} chart={c} />
          ))}
        </section>
      )}

      {/* Tables */}
      {data.tables && data.tables.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          {data.tables.map((t) => (
            <TableBlock key={t.id} table={t} />
          ))}
        </section>
      )}

      {/* Markdown narrative */}
      {markdown && markdown.trim() && (
        <section style={{ marginTop: '2.5rem' }} className="report-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </section>
      )}

      {/* Citation */}
      <CitationBox meta={data.meta} />

      {/* Prev / Next nav */}
      <nav
        className="flex justify-between items-center gap-3"
        style={{ marginTop: '2.5rem', flexWrap: 'wrap' }}
        aria-label="Navegación entre informes"
      >
        {prev ? (
          <Link to={`/${prev.slug}`} className="btn">
            <ArrowLeft size={14} />
            <span>Anterior: {prev.shortTitle}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/${next.slug}`} className="btn">
            <span>Siguiente: {next.shortTitle}</span>
            <ArrowRight size={14} />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

function TableBlock({ table }: { table: ReportTable }) {
  const rows = table.maxRows ? table.rows.slice(0, table.maxRows) : table.rows;
  return (
    <div className="chart-card">
      <h3 className="chart-title">{table.title}</h3>
      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.maxRows && table.rows.length > table.maxRows && (
        <p className="text-sm text-tertiary" style={{ marginTop: '0.5rem' }}>
          Mostrando {table.maxRows} de {table.rows.length.toLocaleString('es-AR')} filas.
        </p>
      )}
    </div>
  );
}
