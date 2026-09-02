import React from "react";
import { SAMPLE_TASKS } from "../../data/swarmModes.js";

export default function InputSection({
  task,
  constraints,
  onTaskChange,
  onConstraintsChange,
  showConstraints,
  agentCount,
  maxIterations,
  roundRobin,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: showConstraints ? "1fr 1fr" : "1fr",
        gap: 20,
        marginBottom: 24,
      }}
    >
      <Card title="📋 Task" subtitle="Describe what the swarm should build.">
        <textarea
          value={task}
          onChange={(e) => onTaskChange(e.target.value)}
          placeholder="Describe what the swarm should build..."
          rows={4}
          aria-label="Task description"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              // bubble — the parent owns submit
              e.preventDefault();
            }
          }}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {SAMPLE_TASKS.slice(0, 3).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onTaskChange(s)}
              style={{
                padding: "4px 10px", borderRadius: 6,
                border: "1px solid var(--border-1)",
                background: "var(--bg-3)", color: "var(--text-3)", fontSize: 11,
              }}
            >
              {s.slice(0, 40)}…
            </button>
          ))}
        </div>
      </Card>

      {showConstraints && (
        <Card title="🎯 Constraints" subtitle="Optional: tone, format, rules, data…">
          <textarea
            value={constraints}
            onChange={(e) => onConstraintsChange(e.target.value)}
            placeholder="Optional: tone, format, rules, data..."
            rows={4}
            aria-label="Constraints and context"
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Stat label="Agents" value={`${agentCount} parallel`} color="#60a5fa" border="rgba(59,130,246,0.15)" bg="rgba(59,130,246,0.06)" />
            <Stat label="Iterations" value={`Max ${maxIterations}`} color="#a78bfa" border="rgba(139,92,246,0.15)" bg="rgba(139,92,246,0.06)" />
            <Stat label="Mode" value={roundRobin ? "Round-robin" : "Parallel"} color="#34d399" border="rgba(16,185,129,0.15)" bg="rgba(16,185,129,0.06)" />
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
      }}
    >
      <header style={{ marginBottom: 10 }}>
        <h3
          style={{
            fontSize: 12, fontWeight: 700, color: "var(--text-2)", margin: 0,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: 11, color: "var(--text-4)", margin: "4px 0 0" }}>{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value, color, border, bg }) {
  return (
    <div
      style={{
        flex: 1, padding: "8px 12px", borderRadius: 8,
        background: bg, border: `1px solid ${border}`,
        fontSize: 11, color,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}
