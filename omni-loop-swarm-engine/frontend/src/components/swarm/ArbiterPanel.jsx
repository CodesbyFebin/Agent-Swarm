import React from "react";
import { motion } from "framer-motion";
import { AGENT_COLORS } from "../../data/swarmModes.js";

export default function ArbiterPanel({ arbiter, candidates }) {
  if (!arbiter) return null;
  const winner = candidates.find((c) => c.id === arbiter.winner);
  const winnerIndex = winner ? candidates.indexOf(winner) : 0;
  const winnerColor = AGENT_COLORS[winnerIndex % AGENT_COLORS.length] || { bg: "#10b981", name: "Agent" };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      style={{
        marginTop: 20, padding: 20, borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))",
        border: "1px solid rgba(16,185,129,0.2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div
          aria-hidden
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}
        >
          ⚖
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>
            Arbiter Decision
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            Confidence: {(arbiter.confidence * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>
        <strong style={{ color: "#10b981" }}>Winner:</strong>{" "}
        {winner?.name || winnerColor.name}
        <br />
        <strong style={{ color: "#10b981" }}>Reasoning:</strong>{" "}
        {arbiter.reasoning}
      </div>
    </motion.div>
  );
}
