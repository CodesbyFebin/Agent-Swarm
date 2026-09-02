import React, { useState } from "react";
import { motion } from "framer-motion";
import { AGENT_BY_ID } from "../data/agents.js";

/**
 * Collapsible card for one agent's evidence. Defaults to expanded so users
 * see the substance, not just the badge.
 */
export default function AgentCard({
  agentId,
  title,
  content,
  badge,
  defaultExpanded = true,
  meta,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const agent = AGENT_BY_ID[agentId];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: "var(--radius-md)",
        border: `1px solid ${agent.color}22`,
        background: `${agent.color}06`,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          width: "100%",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "transparent",
          border: "none",
          borderBottom: expanded ? `1px solid ${agent.color}11` : "none",
          textAlign: "left",
        }}
      >
        <span aria-hidden style={{ fontSize: 16 }}>{agent.icon}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: agent.color,
            flex: 1,
          }}
        >
          {title}
        </span>
        {meta && (
          <span style={{ fontSize: 10, color: "var(--text-4)" }}>{meta}</span>
        )}
        {badge}
        <span aria-hidden style={{ fontSize: 10, color: "var(--text-4)" }}>
          {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded && content && (
        <div
          style={{
            padding: "12px 16px",
            fontSize: 12,
            color: "var(--text-2)",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content}
        </div>
      )}
    </motion.div>
  );
}
