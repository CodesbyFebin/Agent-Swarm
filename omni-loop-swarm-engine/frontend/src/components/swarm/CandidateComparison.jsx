import React, { useMemo, useState } from "react";
import { alignDiff, diffStats } from "../../lib/diff.js";
import { AGENT_COLORS } from "../../data/swarmModes.js";

const ROW_STYLE = {
  same: { background: "transparent" },
  removed: { background: "rgba(239,68,68,0.12)" },
  added: { background: "rgba(16,185,129,0.12)" },
};

function CandidateColumn({ candidate, index, isWinner }) {
  const color = AGENT_COLORS[index % AGENT_COLORS.length] || { bg: "#3b82f6", name: "Agent" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        aria-hidden
        style={{
          width: 22, height: 22, borderRadius: 6,
          background: `linear-gradient(135deg, ${candidate.color || color.bg}, ${(candidate.color || color.bg) + "88"})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0,
        }}
      >
        {(candidate.name || color.name)[0]}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: candidate.color || color.bg }}>
        {candidate.name}
      </span>
      {isWinner && <span style={{ fontSize: 10 }}>🏆</span>}
    </div>
  );
}

export default function CandidateComparison({ candidates, winnerId }) {
  const [leftId, setLeftId] = useState(winnerId || candidates[0]?.id);
  const [rightId, setRightId] = useState(
    candidates.find((c) => c.id !== (winnerId || candidates[0]?.id))?.id || candidates[0]?.id
  );

  const left = candidates.find((c) => c.id === leftId) || candidates[0];
  const right = candidates.find((c) => c.id === rightId) || candidates[1] || candidates[0];
  const leftIndex = candidates.indexOf(left);
  const rightIndex = candidates.indexOf(right);

  const rows = useMemo(
    () => alignDiff(left?.solution || "", right?.solution || ""),
    [left?.solution, right?.solution]
  );
  const stats = useMemo(
    () => diffStats(left?.solution || "", right?.solution || ""),
    [left?.solution, right?.solution]
  );

  if (candidates.length < 2) return null;

  return (
    <div
      style={{
        background: "var(--bg-2)", border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-lg)", padding: 16, marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <select
          aria-label="Compare: left candidate"
          value={leftId}
          onChange={(e) => setLeftId(e.target.value)}
          style={{ fontSize: 12 }}
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.id === winnerId ? " (winner)" : ""}</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: "var(--text-4)" }}>vs</span>
        <select
          aria-label="Compare: right candidate"
          value={rightId}
          onChange={(e) => setRightId(e.target.value)}
          style={{ fontSize: 12 }}
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.id === winnerId ? " (winner)" : ""}</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: "auto" }}>
          <span style={{ color: "#10b981" }}>+{stats.added}</span>{" "}
          <span style={{ color: "#ef4444" }}>-{stats.removed}</span>{" "}
          {stats.same} unchanged
        </span>
      </div>

      <div
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          border: "1px solid var(--border-1)", borderRadius: 8, overflow: "hidden",
        }}
      >
        <div style={{ padding: "8px 12px", borderRight: "1px solid var(--border-1)", borderBottom: "1px solid var(--border-1)", background: "var(--bg-3)" }}>
          {left && <CandidateColumn candidate={left} index={leftIndex} isWinner={left.id === winnerId} />}
        </div>
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-1)", background: "var(--bg-3)" }}>
          {right && <CandidateColumn candidate={right} index={rightIndex} isWinner={right.id === winnerId} />}
        </div>

        <div
          style={{
            gridColumn: "1 / -1", maxHeight: 420, overflow: "auto",
            fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td
                    style={{
                      ...ROW_STYLE[row.type === "added" ? "same" : row.type],
                      borderRight: "1px solid var(--border-1)",
                      padding: "1px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      color: row.left === null ? "var(--text-4)" : "var(--text-1)",
                      width: "50%",
                    }}
                  >
                    {row.left ?? ""}
                  </td>
                  <td
                    style={{
                      ...ROW_STYLE[row.type === "removed" ? "same" : row.type],
                      padding: "1px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      color: row.right === null ? "var(--text-4)" : "var(--text-1)",
                      width: "50%",
                    }}
                  >
                    {row.right ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
