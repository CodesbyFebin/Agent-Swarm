import React from "react";
import { motion } from "framer-motion";
import { AGENTS } from "../data/agents.js";

/**
 * Visualises the closed-loop pipeline. `phase` is one of:
 *   "idle" | "builder" | "reviewer" | "remediation" | "re-review" | "master" | "done"
 *
 * The animation reflects actual agent activity, not a fixed timer.
 */
export default function PipelineDiagram({ phase, activeAgent }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Pipeline status: ${phase}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        marginBottom: 32,
        padding: "24px 0",
        overflowX: "auto",
        flexWrap: "nowrap",
      }}
    >
      {AGENTS.map((agent, i) => {
        const status = computeStatus(agent.id, phase, activeAgent);
        return (
          <React.Fragment key={agent.id}>
            <Node agent={agent} status={status} />
            {i < AGENTS.length - 1 && (
              <Connector
                from={agent}
                to={AGENTS[i + 1]}
                active={shouldGlow(agent.id, AGENTS[i + 1].id, phase, activeAgent)}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function computeStatus(agentId, phase, active) {
  if (phase === "idle") return "waiting";
  if (phase === "done") return "done";
  // Order of completed work
  const order = ["builder", "reviewer", "remediation", "reviewer", "master"];
  const completed = active
    ? order.slice(0, order.indexOf(active))
    : [];
  if (active === agentId) return "active";
  if (completed.includes(agentId)) return "done";
  return "waiting";
}

function shouldGlow(fromId, toId, phase, active) {
  // A connector glows when its left endpoint is done and the right endpoint
  // is either active or done.
  const order = ["builder", "reviewer", "remediation", "reviewer", "master"];
  if (!active) return false;
  const idx = order.indexOf(active);
  if (idx === -1) return false;
  return (
    order.indexOf(fromId) < idx && order.indexOf(toId) <= idx
  );
}

function Node({ agent, status }) {
  return (
    <motion.div
      animate={{ scale: status === "active" ? 1.05 : 1 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        minWidth: 120,
        flexShrink: 0,
      }}
    >
      <motion.div
        animate={{
          boxShadow:
            status === "active"
              ? `0 0 30px ${agent.glow}, 0 0 60px ${agent.glow}`
              : status === "done"
                ? `0 0 15px ${agent.glow}`
                : "0 0 0px transparent",
        }}
        transition={{ duration: 0.5 }}
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background:
            status === "waiting"
              ? "var(--bg-3)"
              : `linear-gradient(135deg, ${agent.color}22, ${agent.color}11)`,
          border: `2px solid ${status === "waiting" ? "var(--border-1)" : agent.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          position: "relative",
        }}
      >
        <span aria-hidden>{agent.icon}</span>
        {status === "active" && (
          <motion.div
            aria-hidden
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: 18,
              border: `2px solid ${agent.color}`,
            }}
          />
        )}
        {status === "done" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--green)",
              color: "#04231a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
        )}
      </motion.div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: status === "waiting" ? "var(--text-4)" : agent.color,
          textAlign: "center",
        }}
      >
        {agent.name}
      </span>
      <span
        style={{
          fontSize: 9,
          color: "var(--text-4)",
          textAlign: "center",
          maxWidth: 120,
          lineHeight: 1.3,
        }}
      >
        {agent.desc}
      </span>
    </motion.div>
  );
}

function Connector({ from, to, active }) {
  return (
    <div
      aria-hidden
      style={{
        flex: 1,
        height: 2,
        background: active
          ? `linear-gradient(90deg, ${from.color}, ${to.color})`
          : "var(--border-1)",
        minWidth: 32,
        maxWidth: 80,
        marginBottom: 30,
        borderRadius: 1,
        position: "relative",
      }}
    >
      {active && (
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute",
            top: -1,
            left: 0,
            width: 30,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${from.color}, transparent)`,
          }}
        />
      )}
    </div>
  );
}
