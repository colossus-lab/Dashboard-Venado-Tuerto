import { useEffect, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveLine } from '@nivo/line';
import type { BarTooltipProps } from '@nivo/bar';
import { useStore } from '../../store/useStore';
import type { ChartConfig } from '../../types/report';

const PALETTE = [
  '#00d4ff',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#22c55e',
  '#f97316',
  '#06b6d4',
  '#eab308',
];

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

function useChartTheme() {
  const theme = useStore((s) => s.theme);
  const isDark = theme === 'dark';
  return {
    isDark,
    nivoTheme: {
      text: { fill: isDark ? '#94a3b8' : '#475569' },
      axis: {
        ticks: { text: { fill: isDark ? '#64748b' : '#64748b', fontSize: 11 } },
        legend: { text: { fill: isDark ? '#94a3b8' : '#334155', fontSize: 12, fontWeight: 600 } },
      },
      grid: { line: { stroke: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
      tooltip: {
        container: {
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#0f172a',
          borderRadius: '10px',
          fontSize: '13px',
          padding: '10px 14px',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.5)'
            : '0 8px 32px rgba(0,0,0,0.12)',
        },
      },
    },
    labelColor: isDark ? '#ffffff' : '#1e293b',
  };
}

interface ChartRendererProps {
  chart: ChartConfig;
  height?: number;
}

export function ChartRenderer({ chart, height = 360 }: ChartRendererProps) {
  if (!chart.data || chart.data.length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-title">{chart.title}</h3>
        <div className="chart-empty">No hay datos suficientes para graficar.</div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3 className="chart-title">{chart.title}</h3>
      {chart.subtitle && <p className="chart-subtitle">{chart.subtitle}</p>}
      <ChartBody chart={chart} height={height} />
    </div>
  );
}

function ChartBody({ chart, height }: ChartRendererProps) {
  switch (chart.type) {
    case 'bar':
      return <BarChartView chart={chart} height={height!} layout="vertical" />;
    case 'horizontalBar':
      return <BarChartView chart={chart} height={height!} layout="horizontal" />;
    case 'stackedBar':
      return <BarChartView chart={chart} height={height!} layout="vertical" stacked />;
    case 'line':
      return <LineChartView chart={chart} height={height!} />;
    case 'area':
      return <LineChartView chart={chart} height={height!} area />;
    case 'pie':
      return <PieChartView chart={chart} height={height!} />;
    default:
      return <BarChartView chart={chart} height={height!} layout="vertical" />;
  }
}

// ─── Bar ───
function BarChartView({
  chart,
  height,
  layout,
  stacked,
}: {
  chart: ChartConfig;
  height: number;
  layout: 'vertical' | 'horizontal';
  stacked?: boolean;
}) {
  const { nivoTheme, labelColor } = useChartTheme();
  const mobile = useIsMobile();

  const indexBy = chart.config?.indexBy || Object.keys(chart.data[0])[0];
  const keys =
    chart.config?.keys ||
    Object.keys(chart.data[0]).filter((k) => k !== indexBy && typeof chart.data[0][k] === 'number');

  const isHorizontal = layout === 'horizontal';
  const dataCount = chart.data.length;
  const cappedHeight = isHorizontal
    ? Math.min(height, Math.max(280, dataCount * (mobile ? 28 : 32) + 60))
    : height;

  return (
    <div style={{ height: cappedHeight }}>
      <ResponsiveBar
        data={chart.data}
        keys={keys}
        indexBy={indexBy}
        margin={{
          top: 20,
          right: mobile ? 10 : 30,
          bottom: isHorizontal ? 50 : mobile ? 70 : 60,
          left: isHorizontal ? (mobile ? 110 : 160) : mobile ? 50 : 60,
        }}
        padding={0.3}
        layout={layout}
        groupMode={stacked ? 'stacked' : 'grouped'}
        colors={chart.config?.colors || PALETTE}
        borderRadius={3}
        axisBottom={{
          tickSize: 0,
          tickPadding: 6,
          tickRotation: !isHorizontal && dataCount > 5 ? -35 : 0,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 6,
          format: isHorizontal
            ? (v: string) => (v.length > 22 ? `${v.slice(0, 20)}…` : v)
            : (v: number) => formatTick(v),
        }}
        enableGridX={isHorizontal}
        enableGridY={!isHorizontal}
        theme={nivoTheme}
        animate
        motionConfig="gentle"
        labelSkipWidth={mobile ? 30 : 24}
        labelSkipHeight={16}
        labelTextColor={labelColor}
        valueFormat={(v: number) => Number(v).toLocaleString('es-AR')}
        tooltip={(props: BarTooltipProps<Record<string, unknown>>) => (
          <CompactTooltip
            label={String(props.indexValue)}
            series={String(props.id)}
            value={Number(props.value)}
            color={props.color}
          />
        )}
        legends={
          keys.length > 1
            ? [
                {
                  dataFrom: 'keys',
                  anchor: 'top-right',
                  direction: 'row',
                  translateY: -16,
                  itemWidth: 100,
                  itemHeight: 18,
                  symbolSize: 10,
                  symbolShape: 'circle',
                  itemTextColor: nivoTheme.text.fill,
                },
              ]
            : []
        }
      />
    </div>
  );
}

// ─── Line / Area ───
function LineChartView({
  chart,
  height,
  area,
}: {
  chart: ChartConfig;
  height: number;
  area?: boolean;
}) {
  const { nivoTheme } = useChartTheme();
  const mobile = useIsMobile();
  const xKey = chart.config?.indexBy || chart.config?.xAxis || Object.keys(chart.data[0])[0];
  const yKeys = chart.config?.keys || Object.keys(chart.data[0]).filter((k) => k !== xKey);

  const lineData = yKeys.map((key, i) => ({
    id: key,
    color: PALETTE[i % PALETTE.length],
    data: chart.data.map((d) => ({ x: d[xKey], y: Number(d[key]) || 0 })),
  }));

  return (
    <div style={{ height: mobile ? Math.min(height, 320) : height }}>
      <ResponsiveLine
        data={lineData}
        margin={mobile ? { top: 24, right: 16, bottom: 60, left: 50 } : { top: 24, right: 32, bottom: 60, left: 60 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        curve="monotoneX"
        colors={chart.config?.colors || PALETTE}
        pointSize={mobile ? 5 : 8}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        pointColor={{ theme: 'background' }}
        enableArea={!!area}
        areaOpacity={area ? 0.16 : 0.06}
        axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: chart.data.length > 8 ? -35 : 0 }}
        axisLeft={{ tickSize: 0, tickPadding: 6, format: formatTick }}
        enableGridX={false}
        theme={nivoTheme}
        animate
        motionConfig="gentle"
        useMesh
        legends={
          yKeys.length > 1
            ? [
                {
                  anchor: 'top-right',
                  direction: 'row',
                  translateY: -24,
                  itemWidth: 100,
                  itemHeight: 18,
                  symbolSize: 10,
                  symbolShape: 'circle',
                  itemTextColor: nivoTheme.text.fill,
                },
              ]
            : []
        }
      />
    </div>
  );
}

// ─── Pie ───
function PieChartView({ chart, height }: { chart: ChartConfig; height: number }) {
  const { nivoTheme, isDark } = useChartTheme();
  const mobile = useIsMobile();
  const dataCount = chart.data.length;

  const formatValue = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return Number(v).toLocaleString('es-AR');
  };

  const mobileLegendHeight = dataCount * 20 + 16;
  const mobileHeight = 260 + mobileLegendHeight;

  return (
    <div style={{ height: mobile ? mobileHeight : Math.min(height, 380) }}>
      <ResponsivePie
        data={chart.data as Array<{ id: string; label: string; value: number }>}
        margin={
          mobile
            ? { top: 20, right: 20, bottom: mobileLegendHeight + 20, left: 20 }
            : { top: 30, right: 90, bottom: 30, left: 90 }
        }
        innerRadius={0.55}
        padAngle={2}
        cornerRadius={5}
        colors={chart.config?.colors || PALETTE}
        borderWidth={0}
        enableArcLinkLabels={!mobile}
        arcLinkLabelsSkipAngle={8}
        arcLinkLabelsTextColor={isDark ? '#94a3b8' : '#334155'}
        arcLinkLabelsThickness={2}
        arcLabelsSkipAngle={mobile ? 25 : 15}
        arcLabelsTextColor="#ffffff"
        arcLabel={(d) => formatValue(d.value)}
        theme={nivoTheme}
        animate
        motionConfig="gentle"
        legends={
          mobile
            ? [
                {
                  anchor: 'bottom',
                  direction: 'column',
                  translateY: mobileLegendHeight + 10,
                  itemWidth: 200,
                  itemHeight: 20,
                  itemTextColor: nivoTheme.text.fill,
                  symbolSize: 10,
                  symbolShape: 'circle',
                },
              ]
            : []
        }
      />
    </div>
  );
}

function formatTick(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return Number(v).toLocaleString('es-AR');
}

function CompactTooltip({
  label,
  series,
  value,
  color,
}: {
  label: string;
  series: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        borderRadius: '8px',
        fontSize: '13px',
        border: `2px solid ${color}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <strong>{label}</strong>
      <br />
      {series}: {Number(value).toLocaleString('es-AR')}
    </div>
  );
}
