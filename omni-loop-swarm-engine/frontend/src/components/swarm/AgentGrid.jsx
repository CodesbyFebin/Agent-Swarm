import React from "react";
import { motion } from "framer-motion";
import { AGENT_COLORS } from "../../data/swarmModes.js";

/**
 * Live agent status row, shown while the swarm is running.
 *
 * `activeIndex` is the index of the agent currently being polled by the SSE
 * stream (or -1 if nothing yet). We don't know which agents are done
 * exactly — the backend's step events tell us via the agent index inside
 * `step.payload.candidate_index`. We compute "done" by comparing names.
 */
export default function AgentGrid({ mode, agentCount, steps }) {
  const isSingle = mode === "single";
  const count = isSingle ? 1 : agentCount;
  const completedNames = new Set(
    steps
      .filter((s) => s.role === "candidate_build" && !s.error)
      .map((s) => s.payload?.candidate_id)
      .filter(Boolean),
  );
  const activeCandidateId = (() => {
    // If we have an in-flight build step (no error), show it as active
    const lastBuild = [...steps].reverse().find((s) => s.role === "candidate_build" && !s.error);
    return lastBuild?.payload?.candidate_id;
  })();

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
      {Array.from({ length: count }).map((_, i) => {
        const color = AGENT_COLORS[i % AGENT_COLORS.length];
        const id = `agent-${i + 1}`;
        const isActive = id === activeCandidateId;
        const isDone = completedNames.has(id) && !isActive;
        return (
          <motion.div
            key={id}
            animate={{
              scale: isActive ? 1.05 : 1,
              borderColor: isActive ? color.bg : isDone ? "#10b981" : "var(--border-1)",
            }}
            style={{
              flex: "1 1 120px",
              padding: "12px 16px",
              borderRadius: 10,
              border: "2px solid var(--border-1)",
              background: isActive ? `${color.bg}11` : "var(--bg-3)",
              display: "flex", alignItems: "center", gap: 10,
              position: "relative", overflow: "hidden",
              minWidth: 110,
            }}
            aria-label={`Agent ${i + 1}: ${isActive ? "building" : isDone ? "complete" : "waiting"}`}
          >
            {isActive && (
              <motion.div
                aria-hidden
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", top: 0, left: 0, width: "50%", height: "100%",
                  background: `linear-gradient(90deg, transparent, ${color.bg}22, transparent)`,
                }}
              />
            )}
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: isDone ? "#10b981" : isActive ? color.bg : "var(--bg-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: "#fff",
              }}
            >
              {isDone ? "✓" : i + 1}
            </div>
            <div>
              <div
                style={{
                  fontSize: 12, fontWeight: 700,
                  color: isDone || isActive ? color.bg : "var(--text-4)",
                }}
              >
                {isSingle ? "Agent" : color.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-4)" }}>
                {isDone ? "Complete" : isActive ? "Building…" : "Waiting"}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
