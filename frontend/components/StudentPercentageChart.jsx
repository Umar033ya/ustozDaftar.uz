"use client";

export default function StudentPercentageChart({ results = [], title = "O'quvchilar ko'rsatkichi (%)" }) {
  if (!results || results.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-xs border border-gray-200 print:hidden mb-6 text-center text-gray-500">
        <p className="font-semibold text-gray-700 mb-1">{title}</p>
        <p className="text-sm">Natijalar kiritilmagan</p>
      </div>
    );
  }

  // Filter students who have valid scores
  const activeResults = results.map((r) => ({
    name: r.studentName || "O'quvchi",
    percentage: Math.min(100, Math.max(0, parseFloat(r.percentage) || 0)),
    total: r.total === "" ? 0 : r.total,
  }));

  const getBarColor = (pct) => {
    if (pct >= 80) return "#10B981"; // Emerald green
    if (pct >= 60) return "#3B82F6"; // Blue
    if (pct >= 40) return "#F59E0B"; // Amber
    return "#EF4444"; // Red
  };

  const itemHeight = 36;
  const chartHeight = Math.max(120, activeResults.length * itemHeight + 30);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xs border border-gray-200 print:hidden mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> 80-100%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> 60-79%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> 40-59%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> &lt;40%
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          className="w-full min-w-[320px]"
          height={chartHeight}
          viewBox={`0 0 600 ${chartHeight}`}
          preserveAspectRatio="none"
        >
          {/* Background grid lines */}
          {[0, 25, 50, 75, 100].map((val) => {
            const x = 160 + (val / 100) * 380;
            return (
              <g key={val}>
                <line
                  x1={x}
                  y1={10}
                  x2={x}
                  y2={chartHeight - 20}
                  stroke="#E5E7EB"
                  strokeDasharray="3 3"
                />
                <text
                  x={x}
                  y={chartHeight - 5}
                  fontSize="10"
                  fill="#9CA3AF"
                  textAnchor="middle"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Student bars */}
          {activeResults.map((item, idx) => {
            const y = idx * itemHeight + 15;
            const barWidth = (item.percentage / 100) * 380;
            const barColor = getBarColor(item.percentage);

            return (
              <g key={idx} className="group transition-all">
                {/* Student Name */}
                <text
                  x={150}
                  y={y + 14}
                  fontSize="12"
                  fontWeight="500"
                  fill="#374151"
                  textAnchor="end"
                >
                  {item.name.length > 20 ? item.name.slice(0, 18) + "..." : item.name}
                </text>

                {/* Bar Background Track */}
                <rect
                  x={160}
                  y={y}
                  width={380}
                  height={20}
                  rx={4}
                  fill="#F3F4F6"
                />

                {/* Animated Score Bar */}
                <rect
                  x={160}
                  y={y}
                  width={Math.max(barWidth, 4)}
                  height={20}
                  rx={4}
                  fill={barColor}
                  className="transition-all duration-500 ease-out"
                />

                {/* Score Text Percentage */}
                <text
                  x={165 + barWidth}
                  y={y + 14}
                  fontSize="11"
                  fontWeight="600"
                  fill={item.percentage > 90 ? "#374151" : barColor}
                >
                  {item.percentage.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
