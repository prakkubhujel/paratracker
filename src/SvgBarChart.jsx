// Minimal styled SVG bar chart. No chart library dependency —
// spec §5.C calls for native SVG/canvas on the web dashboard.
export default function SvgBarChart({ data, valueKey, labelKey, height = 220, title }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-400 text-sm py-8 text-center">No data for this range.</p>;
  }

  const width = Math.max(data.length * 56, 320);
  const padding = { top: 24, right: 12, bottom: 32, left: 12 };
  const chartHeight = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map((d) => d[valueKey]), 1);
  const barWidth = 32;
  const gap = (width - padding.left - padding.right) / data.length;

  return (
    <div className="overflow-x-auto">
      {title && <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>}
      <svg width={width} height={height} role="img" aria-label={title || 'Bar chart'}>
        {data.map((d, i) => {
          const barHeight = (d[valueKey] / maxVal) * chartHeight;
          const x = padding.left + i * gap + (gap - barWidth) / 2;
          const y = padding.top + (chartHeight - barHeight);

          return (
            <g key={d[labelKey]}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill="#0F6E56"
                fillOpacity={0.85}
              >
                <title>{`${d[labelKey]}: ${d[valueKey]}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="11"
                fill="#374151"
              >
                {d[valueKey]}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {d[labelKey]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
