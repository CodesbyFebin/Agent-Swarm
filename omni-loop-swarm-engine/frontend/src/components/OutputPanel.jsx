import React from "react";
import { motion } from "framer-motion";
import { AGENTS } from "../data/agents.js";
import AgentCard from "./AgentCard.jsx";
import DecisionBadge from "./DecisionBadge.jsx";
import FinalOutput from "./FinalOutput.jsx";
import { formatNumber, formatDuration } from "../lib/format.js";

export default function OutputPanel({ result, phase }) {
  return (
    <aside
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        maxHeight: "min(80vh, 720px)",
        overflowY: "auto",
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-2)",
          marginBottom: 16,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        📡 Swarm Output
      </h3>

      {!result && phase === "idle" && <IdleState />}
      {!result && phase !== "idle" && <RunningState phase={phase} />}
      {result && <ResultView result={result} />}
    </aside>
  );
}

function IdleState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        color: "var(--text-5)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden>
        🌀
      </div>
      <p style={{ fontSize: 14 }}>
        Enter a task and execute the swarm engine to see the closed-loop
        process in action.
      </p>
    </div>
  );
}

function RunningState({ phase }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {AGENTS.map((agent) => {
        const status = phaseStatus(agent.id, phase);
        return (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              padding: 12,
              borderRadius: 10,
              background:
                status === "active"
                  ? `${agent.color}11`
                  : status === "done"
                    ? "rgba(16,185,129,0.05)"
                    : "var(--bg-3)",
              border: `1px solid ${
                status === "active"
                  ? agent.color + "44"
                  : status === "done"
                    ? "#10b98133"
                    : "var(--border-1)"
              }`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span aria-hidden style={{ fontSize: 20 }}>
              {agent.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: status === "waiting" ? "var(--text-5)" : agent.color,
                }}
              >
                {agent.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-4)" }}>
                {status === "active"
                  ? "Processing…"
                  : status === "done"
                    ? "Completed ✓"
                    : "Waiting…"}
              </div>
            </div>
            {status === "active" && (
              <motion.div
                aria-hidden
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                style={{ fontSize: 16 }}
              >
                ⚙
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function phaseStatus(agentId, phase) {
  const order = ["builder", "reviewer", "remediation", "reviewer", "master"];
  const idx = order.indexOf(phase);
  if (idx === -1) return "waiting";
  const myIdx = order.indexOf(agentId);
  if (myIdx === -1) return "waiting";
  if (myIdx === idx) return "active";
  if (myIdx < idx) return "done";
  return "waiting";
}

function ResultView({ result }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <AgentCard
        agentId="builder"
        title="Builder Evidence"
        content={result.builder?.evidence}
      />

      <AgentCard
        agentId="reviewer"
        title="Reviewer Evidence"
        content={result.reviewer?.evidence}
        badge={<DecisionBadge kind="decision" value={result.reviewer?.decision} />}
      />

      {result.remediation?.active && (
        <AgentCard
          agentId="remediation"
          title="Remediation Evidence"
          content={result.remediation?.evidence}
        />
      )}

      <AgentCard
        agentId="master"
        title="Master Reviewer Evidence"
        content={result.master_reviewer?.evidence}
        badge={<DecisionBadge kind="approval" value={result.master_reviewer?.approval} />}
      />

      {result.loop_count > 0 && (
        <div
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            fontSize: 12,
            color: "var(--amber)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          🔄 Remediation loops: {result.loop_count}
        </div>
      )}

      <FinalOutput text={result.final_output} />

      {result.tokens && result.tokens.total_tokens > 0 && (
        <TokenUsage result={result} />
      )}
    </motion.div>
  );
}

function TokenUsage({ result }) {
  const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = result.tokens;
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "10px 14px",
        borderRadius: 8,
        background: "var(--bg-3)",
        fontSize: 11,
        color: "var(--text-3)",
        flexWrap: "wrap",
      }}
    >
      <span>Model: <strong style={{ color: "var(--text-2)" }}>{result.model}</strong></span>
      <span>Prompt: <strong style={{ color: "var(--text-2)" }}>{formatNumber(prompt_tokens)}</strong></span>
      <span>Completion: <strong style={{ color: "var(--text-2)" }}>{formatNumber(completion_tokens)}</strong></span>
      <span>Total: <strong style={{ color: "var(--text-2)" }}>{formatNumber(total_tokens)}</strong></span>
      {result.total_elapsed_seconds > 0 && (
        <span>Time: <strong style={{ color: "var(--text-2)" }}>{formatDuration(result.total_elapsed_seconds)}</strong></span>
      )}
    </div>
  );
}
