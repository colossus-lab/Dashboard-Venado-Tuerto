import { useState } from 'react';
import { Check, Copy, ExternalLink, BookText } from 'lucide-react';
import type { ReportMeta } from '../../types/report';

interface CitationBoxProps {
  meta: ReportMeta;
}

export function CitationBox({ meta }: CitationBoxProps) {
  const [copied, setCopied] = useState(false);
  const year = new Date().getFullYear();
  const citation = `Municipalidad de Venado Tuerto. (${year}). ${meta.title}. Portal de Datos Abiertos de Venado Tuerto. ${meta.source}. Licencia: ${meta.license || 'CC-BY'}.`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <aside className="citation-box" aria-label="Cómo citar este informe">
      <div className="citation-title">
        <BookText size={16} aria-hidden="true" />
        Cómo citar este informe
      </div>
      <div className="citation-text">{citation}</div>
      <div className="citation-actions">
        <button onClick={onCopy} className="btn">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar cita'}
        </button>
        <a className="btn" href={meta.source} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
          Ver en portal CKAN
        </a>
      </div>
    </aside>
  );
}
