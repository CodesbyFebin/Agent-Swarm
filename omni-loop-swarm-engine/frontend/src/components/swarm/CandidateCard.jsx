import React, { useState } from "react";
import { motion } from "framer-motion";
import { AGENT_COLORS } from "../../data/swarmModes.js";

/**
 * One candidate's result card. Click to expand and see the evidence.
 */
export default function CandidateCard({ candidate, index, isWinner, isSelected, onSelect, mode }) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const color = AGENT_COLORS[index % AGENT_COLORS.length] || { bg: "#3b82f6", name: "Agent" };
  const expanded = isSelected || localExpanded;
  const isSingle = mode === "single";
  const quality = (candidate.quality || 0) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      onClick={() => {
        onSelect(isSelected ? null : candidate.id);
        setLocalExpanded((v) => !v);
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(isSelected ? null : candidate.id);
          setLocalExpanded((v) => !v);
        }
      }}
      style={{
        background: "var(--bg-2)",
        border: `1px solid ${isSelected ? candidate.color || color.bg : "var(--border-1)"}`,
        borderRadius: "var(--radius-lg)",
        padding: 18,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isWinner && (
        <div
          style={{
            position: "absolute", top: 10, right: 10,
            padding: "3px 8px", borderRadius: 6,
            background: "linear-gradient(135deg, #10b981, #059669)",
            fontSize: 10, fontWeight: 800, color: "#fff",
          }}
        >
          🏆 WINNER
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          aria-hidden
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${candidate.color || color.bg}, ${(candidate.color || color.bg) + "88"})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 900, color: "#fff",
          }}
        >
          {(candidate.name || color.name)[0]}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: candidate.color || color.bg }}>
            {isSingle ? "Agent" : candidate.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)" }}>
            {candidate.model} • {candidate.iterations} iter
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "10px 12px", borderRadius: 8,
          background: "rgba(0,0,0,0.3)",
          fontSize: 12, color: "#cbd5e1", lineHeight: 1.6,
          marginBottom: 12, whiteSpace: "pre-wrap",
          maxHeight: expanded ? "none" : 80,
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {candidate.solution}
      </div>

      {candidate.quality !== undefined && (
        <div style={{ display: "flex", gap: 8 }}>
          <div
            style={{
              flex: 1, padding: "6px 10px", borderRadius: 6,
              background: "rgba(16,185,129,0.06)",
              border: "1px solid rgba(16,185,129,0.15)",
              fontSize: 11, color: "#34d399", textAlign: "center",
            }}
          >
            Quality: {quality.toFixed(0)}%
          </div>
          <div
            style={{
              flex: 1, padding: "6px 10px", borderRadius: 6,
              background: "rgba(139,92,246,0.06)",
              border: "1px solid rgba(139,92,246,0.15)",
              fontSize: 11, color: "#a78bfa", textAlign: "center",
            }}
          >
            Score: {(quality / 10).toFixed(1)}/10
          </div>
        </div>
      )}

      {expanded && candidate.evidence && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-1)" }}
        >
          <div
            style={{
              fontSize: 10, fontWeight: 700, color: "var(--text-3)",
              marginBottom: 6, textTransform: "uppercase",
            }}
          >
            Evidence
          </div>
          <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.6 }}>
            {candidate.evidence}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
