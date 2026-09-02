import React from "react";
import { motion } from "framer-motion";
import { SWARM_MODE_BY_ID } from "../../data/swarmModes.js";

export default function IdleState({ mode }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "60px 20px", color: "var(--text-5)",
      }}
    >
      <motion.div
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ fontSize: 64, marginBottom: 20, opacity: 0.3 }}
      >
        ⬡
      </motion.div>
      <p style={{ fontSize: 15, textAlign: "center", maxWidth: 400, lineHeight: 1.7 }}>
        Enter a task above and execute the swarm engine.
        <br />
        <span style={{ color: "var(--text-4)", fontSize: 13 }}>
          {SWARM_MODE_BY_ID[mode]?.desc}
        </span>
      </p>
    </div>
  );
}
