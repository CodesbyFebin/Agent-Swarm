import React from "react";
import { motion } from "framer-motion";

const SAMPLE_TASKS = [
  "Implement a TypeScript function that merges k sorted linked lists.",
  "Write a 200-word blog post explaining why closed-loop LLM pipelines help.",
  "Analyse the tradeoffs of Postgres vs MongoDB for a multi-tenant SaaS.",
];

export default function TaskInput({
  task,
  constraints,
  onTaskChange,
  onConstraintsChange,
  onSubmit,
  disabled,
  phase,
  error,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="📋 User Task" subtitle="What should the swarm produce?">
        <textarea
          value={task}
          onChange={(e) => onTaskChange(e.target.value)}
          placeholder="Describe what you want the swarm to build..."
          rows={5}
          aria-label="Task description"
          style={{ width: "100%" }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !disabled && task.trim()) {
              onSubmit();
            }
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          {SAMPLE_TASKS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onTaskChange(s)}
              disabled={disabled}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--border-1)",
                background: "transparent",
                color: "var(--text-3)",
                fontSize: 11,
              }}
            >
              {s.slice(0, 32)}…
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="🎯 Constraints & Context"
        subtitle="Optional: tone, format, rules, data, audience."
      >
        <textarea
          value={constraints}
          onChange={(e) => onConstraintsChange(e.target.value)}
          placeholder="Optional: tone, format, specific rules, data..."
          rows={3}
          aria-label="Constraints and context"
          style={{ width: "100%" }}
        />
      </Card>

      <motion.button
        whileHover={!disabled ? { scale: 1.02 } : undefined}
        whileTap={!disabled ? { scale: 0.98 } : undefined}
        onClick={onSubmit}
        disabled={disabled || !task.trim()}
        aria-busy={disabled}
        style={{
          padding: "16px 32px",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: disabled
            ? "var(--bg-3)"
            : "linear-gradient(135deg, var(--blue), var(--purple))",
          color: disabled ? "var(--text-4)" : "#fff",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.02em",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {disabled
          ? `🔄 Processing — ${phase.toUpperCase()}…`
          : "⚡ Execute Swarm Engine  ⌘↵"}
      </motion.button>

      {error && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: 14,
            borderRadius: "var(--radius-sm)",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          ❌ {error}
        </motion.div>
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
      <header style={{ marginBottom: 12 }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-2)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: 11, color: "var(--text-4)", margin: "4px 0 0" }}>
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}
