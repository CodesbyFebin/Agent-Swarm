import React from "react";
import { motion } from "framer-motion";
import { SWARM_MODES } from "../../data/swarmModes.js";
import { MODEL_BY_ID } from "../../data/models.js";

export default function SwarmHeader({
  mode,
  onModeChange,
  agentCount,
  defaultModel,
  phaseLabel,
  onToggleSettings,
  settingsOpen,
  onReset,
  phase,
}) {
  const modelLabel = MODEL_BY_ID[defaultModel]?.label || defaultModel || "auto (free tier)";
  const isRunning = phase !== "idle" && phase !== "complete" && phase !== "error";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        padding: "16px 32px",
        borderBottom: "1px solid var(--border-1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backdropFilter: "blur(20px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(9,9,11,0.85)",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <motion.div
          aria-hidden
          animate={{ rotate: isRunning ? 360 : 0 }}
          transition={{ duration: 2, repeat: isRunning ? Infinity : 0, ease: "linear" }}
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 900,
          }}
        >
          ⬡
        </motion.div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            SWARM ORCHESTRATOR
          </h1>
          <p
            style={{
              fontSize: 11, color: "#64748b", margin: 0,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {phaseLabel} • {mode === "single" ? "1 Agent" : `${agentCount} Agents`} • {modelLabel}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {SWARM_MODES.map((m) => {
          const active = mode === m.id;
          return (
            <motion.button
              key={m.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onModeChange(m.id)}
              aria-pressed={active}
              aria-label={`${m.label} mode — ${m.desc}`}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${active ? "rgba(139,92,246,0.5)" : "var(--border-2)"}`,
                background: active
                  ? "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))"
                  : "rgba(255,255,255,0.02)",
                color: active ? "#c4b5fd" : "#64748b",
                fontSize: 12, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 6,
                letterSpacing: "0.02em",
              }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>{m.icon}</span>
              {m.label}
            </motion.button>
          );
        })}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-label="Toggle settings"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border-2)",
            background: settingsOpen ? "var(--bg-2)" : "transparent",
            color: "#94a3b8",
            fontSize: 14,
            marginLeft: 4,
          }}
        >
          ⚙
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          aria-label="Reset the orchestrator"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border-2)",
            background: "transparent",
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          ↻
        </motion.button>
      </div>
    </motion.header>
  );
}
