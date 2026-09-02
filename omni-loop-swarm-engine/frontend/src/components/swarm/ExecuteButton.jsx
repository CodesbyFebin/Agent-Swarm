import React from "react";
import { motion } from "framer-motion";

export default function ExecuteButton({
  idle, onSubmit, onCancel, disabled, label, cancelLabel,
}) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      onClick={idle ? onSubmit : onCancel}
      disabled={idle && disabled}
      aria-busy={!idle}
      style={{
        width: "100%", padding: "14px 32px", borderRadius: "var(--radius-md)",
        border: "none",
        background: idle
          ? (disabled ? "var(--bg-3)" : "linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)")
          : "rgba(239,68,68,0.15)",
        color: idle ? (disabled ? "var(--text-4)" : "#fff") : "#fca5a5",
        fontSize: 14, fontWeight: 800,
        cursor: idle && disabled ? "not-allowed" : "pointer",
        letterSpacing: "0.03em", marginBottom: 24,
      }}
    >
      {idle ? label : cancelLabel}
    </motion.button>
  );
}
