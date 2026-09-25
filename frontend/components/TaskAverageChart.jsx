"use client";

export default function TaskAverageChart({ tasks = [], taskAverages = [] }) {
  if (!tasks || tasks.length === 0 || !taskAverages || taskAverages.length === 0) {
    return null;
  }

  const chartHeight = 180;
  const barGap = 20;
  const barWidth = Math.max(32, Math.min(60, Math.floor(450 / tasks.length - barGap)));
  const svgWidth = Math.max(360, tasks.length * (barWidth + barGap) + 80);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xs border border-gray-200 print:hidden mb-6">
      <h3 className="text-base font-bold text-gray-900 mb-4">
        Topshiriqlar bo'yicha o'rtacha o'zlashtirish (%)
      </h3>

      <div className="w-full overflow-x-auto">
        <svg
          className="w-full min-w-[320px]"
          height={chartHeight}
          viewBox={`0 0 ${svgWidth} ${chartHeight}`}
        >
          {/* Y-axis grid lines (0%, 25%, 50%, 75%, 100%) */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = 140 - (val / 100) * 110;
            return (
              <g key={val}>
                <line
                  x1={40}
                  y1={y}
                  x2={svgWidth - 20}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeDasharray="3 3"
                />
                <text
                  x={32}
                  y={y + 4}
                  fontSize="10"
                  fill="#9CA3AF"
                  textAnchor="end"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Task Vertical Bars */}
          {tasks.map((task, idx) => {
            const avgPct = parseFloat(taskAverages[idx]) || 0;
            const barHeight = (avgPct / 100) * 110;
            const x = 60 + idx * (barWidth + barGap);
            const y = 140 - barHeight;

            let color = "#3B82F6";
            if (avgPct >= 80) color = "#10B981";
            else if (avgPct >= 60) color = "#3B82F6";
            else if (avgPct >= 40) color = "#F59E0B";
            else color = "#EF4444";

            return (
              <g key={idx}>
                {/* Score label on top of bar */}
                <text
                  x={x + barWidth / 2}
                  y={Math.max(15, y - 6)}
                  fontSize="11"
                  fontWeight="700"
                  fill={color}
                  textAnchor="middle"
                >
                  {avgPct.toFixed(1)}%
                </text>

                {/* Track background */}
                <rect
                  x={x}
                  y={30}
                  width={barWidth}
                  height={110}
                  rx={4}
                  fill="#F3F4F6"
                />

                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill={color}
                  className="transition-all duration-500 ease-out"
                />

                {/* Task Label below X-axis */}
                <text
                  x={x + barWidth / 2}
                  y={158}
                  fontSize="11"
                  fontWeight="600"
                  fill="#374151"
                  textAnchor="middle"
                >
                  {task.number}-t
                </text>
                <text
                  x={x + barWidth / 2}
                  y={170}
                  fontSize="9"
                  fill="#6B7280"
                  textAnchor="middle"
                >
                  (max: {task.maxScore})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
