// Shared performance bands for the dashboard charts. Kept in one place so the
// bar colours and the legend can never disagree.
export const PERFORMANCE_BANDS = [
  { min: 80, color: "#059669", label: "80–100%" },
  { min: 60, color: "#2563EB", label: "60–79%" },
  { min: 40, color: "#D97706", label: "40–59%" },
  { min: 0, color: "#DC2626", label: "<40%" },
];

export function bandColor(percentage) {
  return (PERFORMANCE_BANDS.find((band) => percentage >= band.min) || PERFORMANCE_BANDS.at(-1)).color;
}

export function ChartLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600" aria-label="Rang ma'nosi">
      {PERFORMANCE_BANDS.map((band) => (
        <li key={band.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: band.color }} />
          {band.label}
        </li>
      ))}
    </ul>
  );
}
