import React, { useState } from "react";
import { motion } from "framer-motion";

/**
 * The final production output. Copy + Download buttons so the artifact is
 * easy to grab.
 */
export default function FinalSwarmOutput({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
      document.body.removeChild(ta);
    }
  }

  function download() {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swarm-output.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!text) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      style={{
        marginTop: 20, padding: 20, borderRadius: "var(--radius-lg)",
        background: "var(--bg-2)",
        border: "1px solid var(--border-2)",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10, flexWrap: "wrap", gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12, fontWeight: 700, color: "var(--text-2)",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          🏆 Final Production Output
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy final output"
            style={{
              padding: "4px 10px", borderRadius: 6,
              border: "1px solid var(--border-2)",
              background: "var(--bg-3)", color: "var(--text-2)",
              fontSize: 11, fontWeight: 600,
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button
            type="button"
            onClick={download}
            aria-label="Download final output"
            style={{
              padding: "4px 10px", borderRadius: 6,
              border: "1px solid var(--border-2)",
              background: "var(--bg-3)", color: "var(--text-2)",
              fontSize: 11, fontWeight: 600,
            }}
          >
            Download
          </button>
        </div>
      </div>
      <pre
        style={{
          fontSize: 13, color: "var(--text-1)", whiteSpace: "pre-wrap",
          margin: 0, lineHeight: 1.7, fontFamily: "inherit",
          maxHeight: 480, overflow: "auto",
        }}
      >
        {text}
      </pre>
    </motion.div>
  );
}
