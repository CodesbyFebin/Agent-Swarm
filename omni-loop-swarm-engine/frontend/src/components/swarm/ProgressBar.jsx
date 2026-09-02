import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProgressBar({ visible, progress }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 3, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            background: "rgba(0,0,0,0.5)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
              borderRadius: 2,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
