import React from "react";
import { motion } from "framer-motion";

export default function Header({ demoMode, onToggleDemo, onToggleSettings, settingsOpen }) {
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
        background: "rgba(10, 10, 15, 0.8)",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--blue), var(--purple))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          ⚡
        </div>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            OMNI-LOOP SWARM ENGINE
          </h1>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
            Closed-Loop Builder → Reviewer → Remediation → Re-review
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onToggleDemo}
          aria-pressed={demoMode}
          aria-label={demoMode ? "Demo mode is on. Click to switch to live mode." : "Live mode. Click to switch to demo."}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: `1px solid ${demoMode ? "var(--green)" : "var(--text-3)"}`,
            background: demoMode ? "rgba(16, 185, 129, 0.1)" : "transparent",
            color: demoMode ? "var(--green)" : "var(--text-3)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {demoMode ? "● DEMO" : "○ LIVE"}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-controls="settings-panel"
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid var(--border-2)",
            background: "var(--bg-3)",
            color: "var(--text-2)",
            fontSize: 12,
          }}
        >
          ⚙ Settings
        </motion.button>
      </div>
    </motion.header>
  );
}
