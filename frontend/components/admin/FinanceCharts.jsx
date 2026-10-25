"use client";

import { useElementWidth } from "@/lib/useElementWidth";
import { compactUZS, dayLabel, formatUZS, monthLabel, STATUS_STYLES } from "./financeFormat";

const CHART_HEIGHT = 220;
const AXIS_LEFT = 56;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 180;

function Card({ title, subtitle, children }) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-xs sm:p-5">
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Revenue bars drawn at the measured container width (scrolls if too many bars). */
function RevenueBars({ points, labelFor, minSlot, color }) {
  const [ref, width] = useElementWidth();
  const max = Math.max(...points.map((p) => p.amount), 0);
  const niceMax = max > 0 ? Math.ceil(max / 10 ** Math.floor(Math.log10(max))) * 10 ** Math.floor(Math.log10(max)) : 1;
  const plotWidth = Math.max(width - AXIS_LEFT - 8, points.length * minSlot);
  const slot = points.length ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(3, Math.min(36, slot * 0.7));
  const labelEvery = Math.max(1, Math.ceil(44 / slot));
  const svgWidth = AXIS_LEFT + plotWidth + 8;
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;

  return (
    <div ref={ref} className="w-full overflow-x-auto" style={{ minHeight: CHART_HEIGHT }}>
      {width > 0 && (
        <svg width={svgWidth} height={CHART_HEIGHT} role="img" aria-label="Tushum diagrammasi" className="block">
          {[0, 0.5, 1].map((f) => {
            const y = PLOT_BOTTOM - f * plotHeight;
            return (
              <g key={f}>
                <line x1={AXIS_LEFT} x2={svgWidth - 8} y1={y} y2={y} stroke="#E5E7EB" strokeDasharray="3 3" />
                <text x={AXIS_LEFT - 6} y={y + 4} fontSize="10" fill="#6B7280" textAnchor="end">
                  {compactUZS(niceMax * f)}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => {
            const h = (p.amount / niceMax) * plotHeight;
            const cx = AXIS_LEFT + slot * i + slot / 2;
            return (
              <g key={p.key}>
                <title>{`${labelFor(p.key)}: ${formatUZS(p.amount)} (${p.count} ta to'lov)`}</title>
                <rect x={cx - barWidth / 2} y={PLOT_BOTTOM - h} width={barWidth} height={Math.max(h, p.amount > 0 ? 2 : 0)} rx={3} fill={color} />
                {i % labelEvery === 0 && (
                  <text x={cx} y={PLOT_BOTTOM + 16} fontSize="10" fill="#374151" textAnchor="middle">
                    {labelFor(p.key)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function ShareBars({ items }) {
  const total = items.reduce((acc, i) => acc + i.value, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-gray-500">Ma&apos;lumot yo&apos;q</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = (item.value / total) * 100;
        return (
          <li key={item.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-gray-800">{item.label}</span>
              <span className="tabular-nums text-gray-600">
                {item.value} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const STATUS_COLORS = {
  success: "#059669",
  pending: "#D97706",
  creating: "#D97706",
  failed: "#DC2626",
  rejected: "#DC2626",
  cancelled: "#6B7280",
  expired: "#9CA3AF",
  review: "#EA580C",
  refunded: "#7C3AED",
};

export default function FinanceCharts({ charts, range }) {
  const statusItems = Object.entries(charts.statusCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({ label: STATUS_STYLES[status]?.label || status, value, color: STATUS_COLORS[status] || "#6B7280" }));
  const d = charts.planDistribution;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Kunlik tushum" subtitle={`${dayLabel(range.from)} – ${dayLabel(range.to)} · faqat to'langan`}>
        <RevenueBars points={charts.daily} labelFor={dayLabel} minSlot={14} color="#2563EB" />
      </Card>
      <Card title="Oylik tushum" subtitle="So'nggi 12 oy · faqat to'langan">
        <RevenueBars points={charts.monthly} labelFor={monthLabel} minSlot={40} color="#059669" />
      </Card>
      <Card title="To'lovlar holati" subtitle="Tanlangan davrda yaratilgan to'lovlar">
        <ShareBars items={statusItems} />
      </Card>
      <Card title="Tariflar taqsimoti" subtitle="Hozirgi holat bo'yicha barcha foydalanuvchilar">
        <ShareBars
          items={[
            { label: "Max (faol)", value: d.max, color: "#7C3AED" },
            { label: "Pro (faol)", value: d.pro, color: "#2563EB" },
            { label: "Muddati tugagan", value: d.expired, color: "#9CA3AF" },
            { label: "Bepul", value: d.free, color: "#D1D5DB" },
          ]}
        />
      </Card>
    </div>
  );
}
