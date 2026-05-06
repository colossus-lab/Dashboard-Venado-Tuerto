import { useEffect, useRef, useState } from 'react';
import type { KPI } from '../../types/report';

interface KPICounterProps {
  kpi: KPI;
}

export function KPICounter({ kpi }: KPICounterProps) {
  const [displayValue, setDisplayValue] = useState<string>(kpi.formatted);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          animate();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnimated]);

  function animate() {
    if (typeof kpi.value !== 'number' || !Number.isFinite(kpi.value)) {
      setDisplayValue(kpi.formatted);
      return;
    }

    // Si el tab está oculto, los timers/raf se throttlean y la animación se ve atascada.
    // Mejor mostrar el valor final directamente.
    if (typeof document !== 'undefined' && document.hidden) {
      setDisplayValue(kpi.formatted);
      return;
    }

    const duration = 1100;
    const start = performance.now();
    const target = kpi.value;
    setDisplayValue('0');

    // Fallback: si requestAnimationFrame es throttled, forzamos el valor final
    // poco después para que el usuario nunca quede viendo un valor intermedio.
    const fallback = setTimeout(() => setDisplayValue(kpi.formatted), duration + 200);

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      if (kpi.formatted.includes('%')) {
        setDisplayValue(`${current.toFixed(1).replace('.', ',')}%`);
      } else if (Math.abs(target) >= 1000) {
        setDisplayValue(Math.round(current).toLocaleString('es-AR'));
      } else if (!Number.isInteger(target)) {
        setDisplayValue(current.toFixed(1).replace('.', ','));
      } else {
        setDisplayValue(Math.round(current).toLocaleString('es-AR'));
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        clearTimeout(fallback);
        setDisplayValue(kpi.formatted);
      }
    };
    requestAnimationFrame(tick);
  }

  const statusClass = kpi.status === 'good'
    ? 'is-good'
    : kpi.status === 'warning'
    ? 'is-warning'
    : kpi.status === 'critical'
    ? 'is-critical'
    : '';

  return (
    <div ref={ref} className="kpi-card">
      <span className={`kpi-value ${statusClass}`}>{displayValue}</span>
      <span className="kpi-label">{kpi.label}</span>
      {kpi.unit && <span className="kpi-unit">{kpi.unit}</span>}
      {kpi.hint && <span className="kpi-hint">{kpi.hint}</span>}
    </div>
  );
}
