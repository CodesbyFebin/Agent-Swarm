import React, { useRef, useState } from "react";
import { formatNumber, formatDuration, relativeTime } from "../../lib/format.js";
import { SWARM_MODE_BY_ID } from "../../data/swarmModes.js";

export default function SwarmHistoryPanel({ history, onRestore, onRemove, onClear, onImport }) {
  const [open, setOpen] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swarm-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const count = onImport(parsed);
      setImportMessage({ ok: true, text: `Imported ${count} run${count === 1 ? "" : "s"}.` });
    } catch (err) {
      setImportMessage({ ok: false, text: err.message || "Import failed." });
    }
    setTimeout(() => setImportMessage(null), 4000);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="swarm-history-panel"
        style={{
          padding: "6px 12px", borderRadius: 8,
          border: "1px solid var(--border-2)",
          background: "var(--bg-3)", color: "var(--text-2)",
          fontSize: 12, fontWeight: 600,
        }}
      >
        📜 History{history.length ? ` (${history.length})` : ""}
      </button>
      {open && (
        <aside
          id="swarm-history-panel"
          role="dialog"
          aria-label="Swarm run history"
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: "min(420px, 100%)",
            background: "var(--bg-1)",
            borderLeft: "1px solid var(--border-1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 100, display: "flex", flexDirection: "column",
            animation: "slideIn 0.2s ease",
          }}
        >
          <div
            style={{
              padding: "16px 20px", borderBottom: "1px solid var(--border-1)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <strong style={{ fontSize: 14 }}>Run History</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={handleImportClick}
                title="Import runs from a JSON file"
                style={{
                  padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--border-2)",
                  background: "transparent", color: "var(--text-3)", fontSize: 11,
                }}
              >
                Import
              </button>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleExport}
                  title="Download all runs as JSON"
                  style={{
                    padding: "4px 10px", borderRadius: 6,
                    border: "1px solid var(--border-2)",
                    background: "transparent", color: "var(--text-3)", fontSize: 11,
                  }}
                >
                  Export
                </button>
              )}
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  style={{
                    padding: "4px 10px", borderRadius: 6,
                    border: "1px solid var(--border-2)",
                    background: "transparent", color: "var(--text-3)", fontSize: 11,
                  }}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close history"
                style={{
                  padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--border-2)",
                  background: "transparent", color: "var(--text-2)", fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          </div>
          {importMessage && (
            <div
              role="status"
              style={{
                padding: "8px 20px", fontSize: 11,
                color: importMessage.ok ? "#10b981" : "#fca5a5",
                background: importMessage.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                borderBottom: "1px solid var(--border-1)",
              }}
            >
              {importMessage.ok ? "✓" : "✕"} {importMessage.text}
            </div>
          )}
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {history.length === 0 && (
              <p style={{ color: "var(--text-4)", fontSize: 12, textAlign: "center", padding: 32 }}>
                No runs yet. Execute the swarm to start building history.
              </p>
            )}
            {history.map((entry) => (
              <article
                key={entry.id}
                style={{
                  padding: 12, borderRadius: 8,
                  background: "var(--bg-2)", border: "1px solid var(--border-1)",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    marginBottom: 6, fontSize: 11, color: "var(--text-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "rgba(139,92,246,0.15)", color: "#c4b5fd" }}>
                    {SWARM_MODE_BY_ID[entry.mode]?.label || entry.mode}
                  </span>
                  <span>· {entry.agentCount} agents</span>
                  {entry.tokens?.total_tokens > 0 && (
                    <span>· {formatNumber(entry.tokens.total_tokens)} tok</span>
                  )}
                  {entry.duration > 0 && (
                    <span>· {formatDuration(entry.duration)}</span>
                  )}
                  <span style={{ marginLeft: "auto" }}>{relativeTime(entry.timestamp)}</span>
                </div>
                <p
                  style={{
                    margin: "0 0 8px", fontSize: 12, color: "var(--text-1)", lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}
                >
                  {entry.task}
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onRestore(entry)}
                    style={{
                      padding: "4px 10px", borderRadius: 6,
                      border: "1px solid var(--blue)", background: "rgba(59,130,246,0.1)",
                      color: "var(--blue)", fontSize: 11, fontWeight: 600,
                    }}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    style={{
                      padding: "4px 10px", borderRadius: 6,
                      border: "1px solid var(--border-2)",
                      background: "transparent", color: "var(--text-3)", fontSize: 11,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      )}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
