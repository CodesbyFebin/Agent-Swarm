import React from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Shows the arbiter's reasoning as it streams in, live, during a run --
 * instead of the user seeing nothing until the whole call completes and
 * ArbiterPanel takes over with the final, static version.
 */
export default function LiveArbiterReasoning({ text }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            marginBottom: 20, padding: 16, borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.06))",
            border: "1px solid rgba(16,185,129,0.2)",
          }}
          aria-live="polite"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span aria-hidden style={{ fontSize: 15 }}>⚖</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Arbiter reasoning
            </span>
            <span aria-hidden style={{ display: "inline-flex", gap: 2 }}>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  style={{ width: 4, height: 4, borderRadius: "50%", background: "#10b981" }}
                />
              ))}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
