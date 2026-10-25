/**
 * Shared rule for "has this student's result been entered?".
 *
 * A real score of 0 is a result; an empty cell is not. Filtering on
 * `total > 0` (the previous rule) dropped students who scored 0 from every
 * average and made the lowest score wrong.
 */
export function isResultEntered(result, type) {
  if (!result) return false;
  if (type === "BSB") {
    return (result.scores || []).some((s) => s !== "" && s !== null && s !== undefined && !Number.isNaN(Number(s)));
  }
  return result.total !== "" && result.total !== null && result.total !== undefined && !Number.isNaN(Number(result.total));
}
