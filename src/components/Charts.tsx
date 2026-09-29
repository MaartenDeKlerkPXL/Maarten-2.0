import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(120, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceTicks(min: number, max: number, count = 3) {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

export interface Point {
  label: string; // korte x-label (bv. "12 okt")
  value: number;
  tooltip?: string;
}

const PAD = { top: 12, right: 12, bottom: 22, left: 36 };

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  const left = Math.min(Math.max(x, 60), width - 60);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-line-strong bg-surface-3/95 px-2.5 py-1.5 text-xs text-text shadow-xl backdrop-blur"
      style={{ left, top: Math.max(0, y - 10) }}
    >
      {children}
    </div>
  );
}

/** Eén reeks door de tijd, met crosshair + tooltip. */
const axisNum = (v: number) => v.toLocaleString("nl-NL", { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 });

export function LineChart({
  points, color = "#3B82F6", height = 150, format = (v: number) => String(v), invert = false, axisFormat = axisNum,
}: { points: Point[]; color?: string; height?: number; format?: (v: number) => string; invert?: boolean; axisFormat?: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const pad = (max - min) * 0.15 || Math.max(1, Math.abs(max) * 0.1);
  min -= pad;
  max += pad;
  const ticks = niceTicks(min + pad, max - pad);
  const left = 10 + Math.max(...ticks.map((t) => axisFormat(t).length)) * 6.5;
  const iw = width - left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const x = (i: number) => left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => {
    const t = (v - min) / (max - min);
    return PAD.top + (invert ? t : 1 - t) * ih;
  };
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${path}L${x(points.length - 1).toFixed(1)},${PAD.top + ih}L${x(0).toFixed(1)},${PAD.top + ih}Z`;
  const gid = `g${color.replace("#", "")}`;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 64))));

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - left;
    const i = points.length === 1 ? 0 : Math.round((px / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg width={width} height={height} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} className="touch-pan-y">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(148 163 184 / 0.1)" />
            <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[10px] tabular">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          (i % labelEvery === 0 && points.length - 1 - i >= labelEvery / 2) || i === points.length - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="fill-faint text-[10px]">
              {p.label}
            </text>
          ) : null,
        )}
        {points.length > 1 && <path d={area} fill={`url(#${gid})`} />}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : points.length < 16 ? 3 : 0} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="rgb(148 163 184 / 0.35)" strokeDasharray="3 3" />}
      </svg>
      {hover != null && (
        <Tooltip x={x(hover)} y={y(points[hover].value)} width={width}>
          <span className="font-semibold tabular">{format(points[hover].value)}</span>
          <span className="ml-1.5 text-muted">{points[hover].tooltip ?? points[hover].label}</span>
        </Tooltip>
      )}
    </div>
  );
}

/** Staven per dag met een doel-lijn (bv. pushups). */
export function BarChart({
  points, targets, color = "#3B82F6", height = 140,
}: { points: Point[]; targets: number[]; color?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(10, ...points.map((p) => p.value), ...targets) * 1.1;
  const iw = width - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const band = iw / Math.max(1, points.length);
  const bw = Math.max(3, Math.min(22, band - 2));
  const y = (v: number) => PAD.top + (1 - v / max) * ih;
  const x = (i: number) => PAD.left + band * i + band / 2;
  const step = targets.map((t, i) => `${i ? "L" : "M"}${(PAD.left + band * i).toFixed(1)},${y(t).toFixed(1)}H${(PAD.left + band * (i + 1)).toFixed(1)}`).join("");
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 44))));

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg width={width} height={height} onPointerLeave={() => setHover(null)} className="touch-pan-y">
        {niceTicks(0, max / 1.1).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(148 163 184 / 0.1)" />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[10px] tabular">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const hit = p.value >= targets[i];
          const h = Math.max(0, PAD.top + ih - y(p.value));
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={PAD.left + band * i} y={PAD.top} width={band} height={ih} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x(i) - bw / 2},${PAD.top + ih}V${y(p.value) + Math.min(4, h)}q0,-${Math.min(4, h)} ${Math.min(4, bw / 2)},-${Math.min(4, h)}H${x(i) + bw / 2 - Math.min(4, bw / 2)}q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)}V${PAD.top + ih}Z`}
                  fill={color}
                  opacity={hit ? 1 : 0.38}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x(i)} y={height - 6} textAnchor="middle" className="fill-faint text-[10px]">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
        <path d={step} fill="none" stroke="#E8ECF4" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 3" />
      </svg>
      {hover != null && (
        <Tooltip x={x(hover)} y={y(Math.max(points[hover].value, targets[hover]))} width={width}>
          <span className="font-semibold tabular">{points[hover].value}</span>
          <span className="text-muted"> / {targets[hover]} · {points[hover].tooltip ?? points[hover].label}</span>
        </Tooltip>
      )}
    </div>
  );
}
