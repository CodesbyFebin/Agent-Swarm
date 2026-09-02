import React, { useState } from "react";
import { formatNumber, formatDuration, relativeTime } from "../lib/format.js";

/**
 * Drawer-style history of past runs. Persisted in localStorage.
 */
export default function HistoryPanel({ history, onRestore, onRemove, onClear }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="history-panel"
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid var(--border-2)",
          background: "var(--bg-3)",
          color: "var(--text-2)",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        📜 History{history.length ? ` (${history.length})` : ""}
      </button>
      {open && (
        <div
          id="history-panel"
          role="dialog"
          aria-label="Run history"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(420px, 100%)",
            background: "var(--bg-1)",
            borderLeft: "1px solid var(--border-1)",
            boxShadow: "var(--shadow-2)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            animation: "slideIn 0.2s ease",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <strong style={{ fontSize: 14 }}>Run History</strong>
            <div style={{ display: "flex", gap: 8 }}>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border-2)",
                    background: "transparent",
                    color: "var(--text-3)",
                    fontSize: 11,
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
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border-2)",
                  background: "transparent",
                  color: "var(--text-2)",
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {history.length === 0 && (
              <p
                style={{
                  color: "var(--text-4)",
                  fontSize: 12,
                  textAlign: "center",
                  padding: 32,
                }}
              >
                No runs yet. Execute the swarm to start building history.
              </p>
            )}
            {history.map((entry) => (
              <article
                key={entry.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--bg-2)",
                  border: "1px solid var(--border-1)",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 6,
                    fontSize: 11,
                    color: "var(--text-3)",
                  }}
                >
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background:
                        entry.approval === "GRANTED"
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(239,68,68,0.15)",
                      color:
                        entry.approval === "GRANTED"
                          ? "var(--green)"
                          : "var(--red)",
                    }}
                  >
                    {entry.approval}
                  </span>
                  <span>{entry.model}</span>
                  {entry.loopCount > 0 && (
                    <span>· {entry.loopCount} loop{entry.loopCount > 1 ? "s" : ""}</span>
                  )}
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
                    margin: "0 0 8px",
                    fontSize: 12,
                    color: "var(--text-1)",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {entry.task}
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onRestore(entry)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--blue)",
                      background: "rgba(59,130,246,0.1)",
                      color: "var(--blue)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border-2)",
                      background: "transparent",
                      color: "var(--text-3)",
                      fontSize: 11,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
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
