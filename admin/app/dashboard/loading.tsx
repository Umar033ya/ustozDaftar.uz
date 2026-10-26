// Shown instantly on navigation while the server loads the page's data, so
// the panel never looks frozen between clicks.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-72 rounded bg-gray-100 dark:bg-gray-800/70" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" />
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" />
    </div>
  );
}
