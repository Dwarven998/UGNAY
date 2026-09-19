import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

export interface ChartPoint { x: number; y: number }

interface TimeChartProps {
  points: ChartPoint[];
  /** Draw a flat line until the next reading (right for lifetime counters that only change occasionally). */
  step?: boolean;
  /** Optional dashed reference line, e.g. the typical value. */
  baseline?: { value: number; label: string } | null;
  color?: string;
  height?: number;
  /** Put x labels on real data points (right for one-point-per-day charts) instead of evenly across the time span. */
  snapTicks?: boolean;
  formatY?: (value: number) => string;
  formatX: (x: number) => string;
  /** Text for the hover card's heading. Defaults to formatX. */
  formatTooltipX?: (x: number) => string;
  valueLabel: string;
  ariaLabel: string;
}

const PAD = { top: 14, right: 16, bottom: 30, left: 44 };

function niceStep(max: number, intervals: number) {
  const raw = Math.max(max, 1) / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

const compact = (value: number) =>
  value >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : value >= 10_000 ? `${Math.round(value / 1000)}K`
    : value >= 1000 ? `${+(value / 1000).toFixed(1)}K` : String(Math.round(value));

export default function TimeChart({
  points, step = false, baseline = null, color = '#0C447C', height = 260,
  snapTicks = false, formatY = compact, formatX, formatTooltipX, valueLabel, ariaLabel,
}: Readonly<TimeChartProps>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(280, entries[0].contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const gradientId = `an-grad-${useId().replace(/:/g, '')}`;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const dataMax = Math.max(0, ...points.map(p => p.y), baseline?.value ?? 0);
  const stepY = niceStep(dataMax, 4);
  const yMax = Math.max(stepY * 4, stepY * Math.ceil(dataMax / stepY));
  const yTicks = Array.from({ length: Math.round(yMax / stepY) + 1 }, (_, i) => i * stepY);

  const xMin = points.length ? points[0].x : 0;
  const xMax = points.length ? points[points.length - 1].x : 1;
  const xSpan = Math.max(xMax - xMin, 1);
  const sx = (x: number) => PAD.left + (points.length > 1 ? ((x - xMin) / xSpan) * innerW : innerW / 2);
  const sy = (y: number) => PAD.top + innerH - (y / yMax) * innerH;

  let line = '';
  points.forEach((p, i) => {
    if (i === 0) line = `M${sx(p.x)},${sy(p.y)}`;
    else line += step ? ` H${sx(p.x)} V${sy(p.y)}` : ` L${sx(p.x)},${sy(p.y)}`;
  });
  const area = points.length > 1
    ? `${line} L${sx(xMax)},${sy(0)} L${sx(xMin)},${sy(0)} Z`
    : '';

  const xTickCount = Math.min(points.length, width < 480 ? 4 : 6);
  const xTicks = xTickCount <= 1
    ? points.map(p => p.x)
    : Array.from({ length: xTickCount }, (_, i) => snapTicks
      ? points[Math.round((i * (points.length - 1)) / (xTickCount - 1))].x
      : xMin + (xSpan * i) / (xTickCount - 1));

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(sx(p.x) - px);
      if (dist < bestDist) { best = i; bestDist = dist; }
    });
    setHover(best);
  };

  const active = hover !== null ? points[hover] : null;
  const tooltipLeft = active ? Math.min(Math.max(sx(active.x), 70), width - 70) : 0;

  return (
    <div className="an-chart" ref={wrapRef} style={{ height }}>
      <svg
        width={width} height={height} role="img" aria-label={ariaLabel}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map(tick => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(tick)} y2={sy(tick)} className="an-chart-grid" />
            <text x={PAD.left - 8} y={sy(tick) + 4} textAnchor="end" className="an-chart-axis">{formatY(tick)}</text>
          </g>
        ))}
        {xTicks.map((tick, i) => (
          <text
            key={`${tick}-${i}`} x={sx(tick)} y={height - 8} className="an-chart-axis"
            textAnchor={i === 0 && xTicks.length > 1 ? 'start' : i === xTicks.length - 1 && xTicks.length > 1 ? 'end' : 'middle'}
          >
            {formatX(tick)}
          </text>
        ))}

        {baseline && (
          <g>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(baseline.value)} y2={sy(baseline.value)} className="an-chart-baseline" />
            <text x={width - PAD.right} y={sy(baseline.value) - 6} textAnchor="end" className="an-chart-baseline-label">{baseline.label}</text>
          </g>
        )}

        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {points.length > 1 && (
          <path d={line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {points.length === 1 && <circle cx={sx(points[0].x)} cy={sy(points[0].y)} r={4} fill={color} />}

        {active && (
          <g>
            <line x1={sx(active.x)} x2={sx(active.x)} y1={PAD.top} y2={PAD.top + innerH} className="an-chart-cursor" />
            <circle cx={sx(active.x)} cy={sy(active.y)} r={5} fill="#fff" stroke={color} strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {active && (
        <div className="an-chart-tip" style={{ left: tooltipLeft, top: Math.max(sy(active.y) - 62, 0) }}>
          <span className="an-chart-tip-x">{(formatTooltipX ?? formatX)(active.x)}</span>
          <span className="an-chart-tip-y"><i style={{ background: color }} />{active.y.toLocaleString()} {valueLabel}</span>
        </div>
      )}
    </div>
  );
}
