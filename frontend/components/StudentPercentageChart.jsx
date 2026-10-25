"use client";

import { useElementWidth } from "@/lib/useElementWidth";
import { bandColor, ChartLegend } from "@/lib/chartColors";

const ROW_HEIGHT = 32;
const BAR_HEIGHT = 18;
const TOP_PADDING = 8;
const AXIS_HEIGHT = 22;
const VALUE_LABEL_WIDTH = 46;
// Conservative glyph width of a 12px/500 font (Cyrillic capitals are wide), used
// to fit names without measuring text; the full name is in the <title> tooltip.
const NAME_CHAR_WIDTH = 7.6;

function fitName(name, maxWidth) {
  const maxChars = Math.max(4, Math.floor(maxWidth / NAME_CHAR_WIDTH));
  return name.length > maxChars ? `${name.slice(0, maxChars - 1).trimEnd()}…` : name;
}

export default function StudentPercentageChart({ results = [], title = "O'quvchilar ko'rsatkichi (%)" }) {
  const [containerRef, width] = useElementWidth();

  if (!results || results.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-xs border border-gray-200 print:hidden text-center text-gray-500 min-w-0">
        <p className="font-semibold text-gray-700 mb-1">{title}</p>
        <p className="text-sm">Natijalar kiritilmagan</p>
      </div>
    );
  }

  const rows = results.map((r) => ({
    name: r.studentName || "O'quvchi",
    percentage: Math.min(100, Math.max(0, parseFloat(r.percentage) || 0)),
  }));

  // The name column takes about a third of the width, within readable bounds.
  const nameWidth = Math.round(Math.min(220, Math.max(96, width * 0.34)));
  const barX = nameWidth + 10;
  const barWidthMax = Math.max(40, width - barX - VALUE_LABEL_WIDTH);
  const chartHeight = TOP_PADDING + rows.length * ROW_HEIGHT + AXIS_HEIGHT;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xs border border-gray-200 print:hidden min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <ChartLegend />
      </div>

      <div ref={containerRef} className="w-full" style={{ minHeight: chartHeight }}>
        {width > 0 && (
          <svg
            width={width}
            height={chartHeight}
            viewBox={`0 0 ${width} ${chartHeight}`}
            role="img"
            aria-label={title}
            className="block"
          >
            {[0, 25, 50, 75, 100].map((val) => {
              const x = barX + (val / 100) * barWidthMax;
              return (
                <g key={val}>
                  <line
                    x1={x}
                    y1={TOP_PADDING - 4}
                    x2={x}
                    y2={chartHeight - AXIS_HEIGHT + 2}
                    stroke="#E5E7EB"
                    strokeDasharray="3 3"
                  />
                  <text x={x} y={chartHeight - 6} fontSize="10" fill="#6B7280" textAnchor="middle">
                    {val}%
                  </text>
                </g>
              );
            })}

            {rows.map((item, idx) => {
              const y = TOP_PADDING + idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
              const barWidth = (item.percentage / 100) * barWidthMax;
              const color = bandColor(item.percentage);

              return (
                <g key={idx}>
                  <title>{`${item.name}: ${item.percentage.toFixed(1)}%`}</title>
                  <text
                    x={nameWidth}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fontSize="12"
                    fontWeight="500"
                    fill="#374151"
                    textAnchor="end"
                  >
                    {fitName(item.name, nameWidth)}
                  </text>
                  <rect x={barX} y={y} width={barWidthMax} height={BAR_HEIGHT} rx={4} fill="#F3F4F6" />
                  <rect
                    x={barX}
                    y={y}
                    width={Math.max(barWidth, 3)}
                    height={BAR_HEIGHT}
                    rx={4}
                    fill={color}
                    className="transition-all duration-500 ease-out"
                  />
                  <text x={barX + barWidth + 6} y={y + BAR_HEIGHT / 2 + 4} fontSize="11" fontWeight="600" fill={color}>
                    {item.percentage.toFixed(1)}%
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
