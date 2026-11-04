/** "Fan o'qituvchisi" line under a result table, also on the printed sheet. */
export default function TeacherSignature({ name }) {
  if (!name) return null;
  return (
    <p className="mt-4 text-sm font-semibold text-gray-900">
      Fan o&apos;qituvchisi: <span className="font-bold">{name}</span>
    </p>
  );
}
