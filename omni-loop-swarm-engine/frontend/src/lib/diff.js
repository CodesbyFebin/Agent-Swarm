/**
 * Minimal line-based diff (LCS-backed), good enough for comparing two
 * candidate solutions side by side. Not trying to be Myers-optimal --
 * candidate outputs are short (a function, a schema, a component), so a
 * classic O(n*m) LCS table is plenty fast and easy to reason about.
 */

/** Returns the LCS length table for two line arrays. */
function lcsTable(a, b) {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

/**
 * Diff two texts line by line. Returns an ordered list of
 * { type: "same" | "removed" | "added", line: string }.
 * "removed" = present in `a` only, "added" = present in `b` only.
 */
export function diffLines(a, b) {
  const linesA = (a ?? "").split("\n");
  const linesB = (b ?? "").split("\n");
  const table = lcsTable(linesA, linesB);

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < linesA.length && j < linesB.length) {
    if (linesA[i] === linesB[j]) {
      ops.push({ type: "same", line: linesA[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ type: "removed", line: linesA[i] });
      i++;
    } else {
      ops.push({ type: "added", line: linesB[j] });
      j++;
    }
  }
  while (i < linesA.length) {
    ops.push({ type: "removed", line: linesA[i] });
    i++;
  }
  while (j < linesB.length) {
    ops.push({ type: "added", line: linesB[j] });
    j++;
  }
  return ops;
}

/**
 * Aligns a diff op list into side-by-side rows: { left, right, type }.
 * A "removed" line gets a blank on the right; an "added" line gets a blank
 * on the left; a "same" line appears on both. `type` on the row is the
 * op's type, used for row highlighting.
 */
export function alignDiff(a, b) {
  const ops = diffLines(a, b);
  return ops.map((op) => {
    if (op.type === "same") return { left: op.line, right: op.line, type: "same" };
    if (op.type === "removed") return { left: op.line, right: null, type: "removed" };
    return { left: null, right: op.line, type: "added" };
  });
}

/** Quick stats for a summary line: how many lines differ between a and b. */
export function diffStats(a, b) {
  const ops = diffLines(a, b);
  const added = ops.filter((o) => o.type === "added").length;
  const removed = ops.filter((o) => o.type === "removed").length;
  const same = ops.filter((o) => o.type === "same").length;
  return { added, removed, same, total: ops.length };
}
