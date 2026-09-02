import React, { useState } from "react";
import { detectLanguage } from "../lib/format.js";

/**
 * Final production output. Renders with simple, dependency-free language-aware
 * styling, plus Copy + Download actions so users can grab the artifact.
 */
export default function FinalOutput({ text }) {
  const [copied, setCopied] = useState(false);
  const lang = detectLanguage(text);
  const filename = `omni-loop-output${lang ? "." + lang : ".txt"}`;

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // older browsers / non-secure context
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // give up silently
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  function download() {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!text) return null;

  return (
    <div
      style={{
        padding: 20,
        borderRadius: "var(--radius-md)",
        background:
          "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))",
        border: "1px solid rgba(16,185,129,0.2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--green)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          🏆 Final Production Output{lang ? ` · ${lang}` : ""}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <ActionButton onClick={copy} label={copied ? "Copied ✓" : "Copy"} />
          <ActionButton onClick={download} label="Download" />
        </div>
      </div>
      <pre
        style={{
          fontSize: 13,
          color: "var(--text-1)",
          whiteSpace: "pre-wrap",
          margin: 0,
          lineHeight: 1.7,
          fontFamily: lang ? "var(--font-mono)" : "inherit",
          maxHeight: 480,
          overflow: "auto",
        }}
      >
        {text}
      </pre>
    </div>
  );
}

function ActionButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid var(--border-2)",
        background: "var(--bg-3)",
        color: "var(--text-2)",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}
