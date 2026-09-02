import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SUGGESTED_MODELS, SUGGESTED_BASE_URLS } from "../data/models.js";

export default function SettingsPanel({
  open,
  settings,
  onChange,
  onReset,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          id="settings-panel"
          aria-label="Pipeline settings"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{ overflow: "hidden", marginBottom: 20 }}
        >
          <div
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
              padding: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {!settings.demoMode && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  fontSize: 11,
                  color: "var(--text-3)",
                  background: "rgba(59, 130, 246, 0.05)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                  padding: 10,
                  borderRadius: 8,
                  lineHeight: 1.5,
                }}
              >
                🔒 Your key is sent directly from this browser to the backend for
                a single request and is never stored server-side. It is saved
                only in this browser's <code>localStorage</code> so you don't
                have to retype it.
              </div>
            )}

            <Field label="API Key" htmlFor="api-key">
              <input
                id="api-key"
                type="password"
                value={settings.apiKey}
                onChange={(e) => onChange({ apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
                style={{ width: "100%" }}
              />
            </Field>

            <Field label="Model" htmlFor="model">
              <input
                id="model"
                list="model-suggestions"
                value={settings.model}
                onChange={(e) => onChange({ model: e.target.value })}
                placeholder="gpt-4o, claude-3-5-sonnet, ..."
                style={{ width: "100%" }}
              />
              <datalist id="model-suggestions">
                {SUGGESTED_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </datalist>
            </Field>

            <Field
              label="Base URL"
              htmlFor="base-url"
              hint="Any OpenAI-compatible /chat/completions endpoint."
            >
              <input
                id="base-url"
                list="base-url-suggestions"
                value={settings.baseUrl}
                onChange={(e) => onChange({ baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                style={{ width: "100%" }}
              />
              <datalist id="base-url-suggestions">
                {SUGGESTED_BASE_URLS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Field>

            <Field
              label="Visual loop count (demo only)"
              htmlFor="loop-count"
              hint="Affects the demo animation. The real pipeline cap is set on the backend."
            >
              <input
                id="loop-count"
                type="number"
                min={0}
                max={3}
                value={settings.maxLoops}
                onChange={(e) =>
                  onChange({
                    maxLoops: Math.max(0, Math.min(3, Number(e.target.value) || 0)),
                  })
                }
                style={{ width: "100%" }}
              />
            </Field>

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={onReset}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-2)",
                  background: "transparent",
                  color: "var(--text-2)",
                  fontSize: 12,
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          marginBottom: 4,
          display: "block",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
