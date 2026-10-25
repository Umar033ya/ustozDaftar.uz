"use client";

import { useElementWidth } from "@/lib/useElementWidth";
import { bandColor } from "@/lib/chartColors";

const CHART_HEIGHT = 200;
const AXIS_LEFT = 40;
const RIGHT_PADDING = 12;
const PLOT_TOP = 26;
const PLOT_HEIGHT = 120;
const PLOT_BOTTOM = PLOT_TOP + PLOT_HEIGHT;
const MIN_SLOT = 44; // narrowest readable column per task (bar + gap)
const MAX_BAR = 56;

export default function TaskAverageChart({ tasks = [], taskAverages = [] }) {
  const [containerRef, width] = useElementWidth();

  if (!tasks || tasks.length === 0 || !taskAverages || taskAverages.length === 0) {
    return null;
  }

  // Fill the available width; with many tasks on a narrow screen fall back to
  // horizontal scrolling instead of squeezing labels into each other.
  const plotWidth = Math.max(width - AXIS_LEFT - RIGHT_PADDING, tasks.length * MIN_SLOT);
  const svgWidth = AXIS_LEFT + plotWidth + RIGHT_PADDING;
  const slot = plotWidth / tasks.length;
  const barWidth = Math.min(MAX_BAR, slot * 0.6);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xs border border-gray-200 print:hidden min-w-0">
      <h3 className="text-base font-bold text-gray-900 mb-4">
        Topshiriqlar bo&apos;yicha o&apos;rtacha o&apos;zlashtirish (%)
      </h3>

      <div ref={containerRef} className="w-full overflow-x-auto" style={{ minHeight: CHART_HEIGHT }}>
        {width > 0 && (
          <svg
            width={svgWidth}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${svgWidth} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Topshiriqlar bo'yicha o'rtacha o'zlashtirish"
            className="block"
          >
            {[0, 25, 50, 75, 100].map((val) => {
              const y = PLOT_BOTTOM - (val / 100) * PLOT_HEIGHT;
              return (
                <g key={val}>
                  <line x1={AXIS_LEFT} y1={y} x2={svgWidth - RIGHT_PADDING} y2={y} stroke="#E5E7EB" strokeDasharray="3 3" />
                  <text x={AXIS_LEFT - 8} y={y + 4} fontSize="10" fill="#6B7280" textAnchor="end">
                    {val}%
                  </text>
                </g>
              );
            })}

            {tasks.map((task, idx) => {
              const avgPct = Math.min(100, Math.max(0, parseFloat(taskAverages[idx]) || 0));
              const barHeight = (avgPct / 100) * PLOT_HEIGHT;
              const cx = AXIS_LEFT + slot * idx + slot / 2;
              const x = cx - barWidth / 2;
              const y = PLOT_BOTTOM - barHeight;
              const color = bandColor(avgPct);

              return (
                <g key={idx}>
                  <title>{`${task.number}-topshiriq: ${avgPct.toFixed(1)}% (maks: ${task.maxScore})`}</title>
                  <rect x={x} y={PLOT_TOP} width={barWidth} height={PLOT_HEIGHT} rx={4} fill="#F3F4F6" />
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={4}
                    fill={color}
                    className="transition-all duration-500 ease-out"
                  />
                  {/* drawn after the track and bar so it is never painted over */}
                  <text x={cx} y={Math.max(14, y - 6)} fontSize="11" fontWeight="700" fill={color} textAnchor="middle">
                    {avgPct.toFixed(1)}%
                  </text>
                  <text x={cx} y={PLOT_BOTTOM + 18} fontSize="11" fontWeight="600" fill="#374151" textAnchor="middle">
                    {task.number}-t
                  </text>
                  <text x={cx} y={PLOT_BOTTOM + 32} fontSize="9" fill="#6B7280" textAnchor="middle">
                    (maks: {task.maxScore})
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
