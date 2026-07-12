"use client";

export type DonutSegment = { label: string; value: number; color: string };

// Hand-rolled SVG donut (stroke-dasharray technique) -- no charting library dependency,
// renders identically on screen and in print.
export function DonutChart({
  segments,
  size = 140,
  strokeWidth = 22,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let offsetAccum = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = total > 0 ? s.value / total : 0;
      const dash = fraction * circumference;
      const arc = { ...s, dash, offset: offsetAccum };
      offsetAccum += dash;
      return arc;
    });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
        {total === 0 ? (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} />
        ) : (
          arcs.map((a, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${a.dash} ${circumference - a.dash}`}
              strokeDashoffset={-a.offset}
            />
          ))
        )}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute" />
      )}
    </div>
  );
}

export function DonutChartWithLegend({
  title,
  segments,
  centerValue,
  centerLabel,
  size = 140,
}: {
  title: string;
  segments: DonutSegment[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div>
      <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-3">{title}</p>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <DonutChart segments={segments} size={size} />
          {(centerValue || centerLabel) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {centerValue && <span className="text-lg font-bold text-ink leading-none">{centerValue}</span>}
              {centerLabel && <span className="text-[10px] text-inkSoft mt-0.5">{centerLabel}</span>}
            </div>
          )}
        </div>
        <div className="space-y-1.5 min-w-0">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-inkSoft truncate">{s.label}</span>
              <span className="text-ink font-medium ml-auto shrink-0">
                {s.value} {total > 0 && `(${Math.round((s.value / total) * 100)}%)`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
