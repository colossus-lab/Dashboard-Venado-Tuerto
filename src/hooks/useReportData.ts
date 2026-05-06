import { useEffect, useState } from 'react';
import type { ReportData } from '../types/report';

interface UseReportDataReturn {
  markdown: string | null;
  data: ReportData | null;
  loading: boolean;
  error: string | null;
}

export function useReportData(mdPath: string, dataPath: string): UseReportDataReturn {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(mdPath).then((r) =>
        r.ok ? r.text() : Promise.reject(new Error(`Markdown no encontrado: ${mdPath}`)),
      ),
      fetch(dataPath).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`Datos no encontrados: ${dataPath}`)),
      ),
    ])
      .then(([md, json]) => {
        if (!cancelled) {
          setMarkdown(md);
          setData(json as ReportData);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mdPath, dataPath]);

  return { markdown, data, loading, error };
}
