"use client";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}

export default function Sparkline({
  values,
  width = 56,
  height = 20,
  stroke = "#188038",
  className = "",
}: SparklineProps) {
  if (values.length < 2) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

interface LineChartProps {
  labels: string[];
  values: Array<number | null>;
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  nullRank?: number;
}

export function LineChart({
  labels,
  values,
  width = 320,
  height = 120,
  stroke = "#1a73e8",
  fill = "rgba(26, 115, 232, 0.08)",
  nullRank = 20,
}: LineChartProps) {
  if (values.length < 2) {
    return (
      <p className="text-sm text-[#5f6368]">Not enough data yet — check back after a few daily ingests.</p>
    );
  }

  const normalized = values.map((v) => v ?? nullRank);
  const max = Math.max(...normalized, 3);
  const min = 1;
  const range = max - min || 1;
  const padding = 8;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const coords = normalized.map((value, index) => {
    const x = padding + (index / (normalized.length - 1)) * innerW;
    const y = padding + ((value - min) / range) * innerH;
    return { x, y, value: values[index] };
  });

  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPoints = [
    `${coords[0].x},${height - padding}`,
    ...coords.map((c) => `${c.x},${c.y}`),
    `${coords[coords.length - 1].x},${height - padding}`,
  ].join(" ");

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <polygon points={areaPoints} fill={fill} />
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePoints}
        />
        {coords.map((c, i) => (
          <circle key={labels[i] ?? i} cx={c.x} cy={c.y} r="2.5" fill={stroke} />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-[#80868b]">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

const RADIUS_LINE_COLORS: Record<number, string> = {
  1: "#188038",
  3: "#1a73e8",
  5: "#e37400",
  10: "#9334e6",
};

export function MultiLineChart({
  labels,
  series,
  width = 320,
  height = 120,
  nullRank = 20,
}: {
  labels: string[];
  series: Array<{ name: string; values: Array<number | null>; distanceMiles?: number }>;
  width?: number;
  height?: number;
  nullRank?: number;
}) {
  if (labels.length < 2 || series.length === 0) {
    return (
      <p className="text-sm text-[#5f6368]">Not enough data yet — check back after a few daily ingests.</p>
    );
  }

  const normalizedSeries = series.map((s) => ({
    ...s,
    values: s.values.map((v) => v ?? nullRank),
  }));

  const allValues = normalizedSeries.flatMap((s) => s.values);
  const max = Math.max(...allValues, 3);
  const min = 1;
  const range = max - min || 1;
  const padding = 8;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {normalizedSeries.map((s) => {
          const stroke =
            (s.distanceMiles != null && RADIUS_LINE_COLORS[s.distanceMiles]) || "#5f6368";
          const coords = s.values.map((value, index) => {
            const x = padding + (index / (s.values.length - 1)) * innerW;
            const y = padding + ((value - min) / range) * innerH;
            return { x, y };
          });
          const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
          return (
            <polyline
              key={s.name}
              fill="none"
              stroke={stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={linePoints}
            />
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => {
          const color =
            (s.distanceMiles != null && RADIUS_LINE_COLORS[s.distanceMiles]) || "#5f6368";
          return (
            <span key={s.name} className="flex items-center gap-1.5 text-[10px] text-[#5f6368]">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />
              {s.name}
            </span>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[#80868b]">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

export function BarChart({
  labels,
  series,
  height = 120,
}: {
  labels: string[];
  series: Array<{ name: string; values: number[]; color: string }>;
  height?: number;
}) {
  if (labels.length === 0) {
    return (
      <p className="text-sm text-[#5f6368]">Not enough data yet — check back after a few daily ingests.</p>
    );
  }

  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const gap = 4;
  const barWidth = Math.max(6, Math.min(20, 300 / labels.length - gap));
  const chartWidth = labels.length * (barWidth + gap);

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${height}`} className="overflow-visible">
        {labels.map((label, i) => {
          const x = i * (barWidth + gap);
          let yBottom = height - 6;
          return (
            <g key={label}>
              {series.map((s) => {
                const value = s.values[i] ?? 0;
                const barH = (value / max) * (height - 16);
                yBottom -= barH;
                return (
                  <rect
                    key={`${label}-${s.name}`}
                    x={x}
                    y={yBottom}
                    width={barWidth}
                    height={barH}
                    fill={s.color}
                    rx={1}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-[10px] text-[#5f6368]">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
