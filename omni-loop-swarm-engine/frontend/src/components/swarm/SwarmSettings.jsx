import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AGENT_COUNT_OPTIONS,
  AGENT_COUNT_MIN,
  AGENT_COUNT_MAX,
  ITERATIONS_MIN,
  ITERATIONS_MAX,
} from "../../data/swarmModes.js";
import { MODELS, SUGGESTED_BASE_URLS } from "../../data/models.js";
import { useModelFavorites } from "../../hooks/useModelFavorites.js";

export default function SwarmSettings({
  open,
  settings,
  onChange,
  onReset,
  showApiFields,
}) {
  const { favorites, isFavorite, toggleFavorite } = useModelFavorites();
  const currentModel = settings.defaultModel.trim();
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          aria-label="Swarm settings"
          style={{ overflow: "hidden", marginBottom: 20 }}
        >
          <div
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
              padding: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {!settings.demoMode && !settings.apiKey.trim() && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  fontSize: 11,
                  color: "var(--text-3)",
                  background: "rgba(16, 185, 129, 0.06)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  padding: 10,
                  borderRadius: 8,
                  lineHeight: 1.5,
                }}
              >
                ⚡ No API key set — this run will use Kilo Gateway's free tier
                (anonymous, rate-limited, a different free model per agent).
                Add your own API key + model + base URL below for a higher
                rate limit or a specific provider.
              </div>
            )}

            <Field label="Agent Count">
              <div style={{ display: "flex", gap: 4 }} role="radiogroup" aria-label="Agent count">
                {AGENT_COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={settings.agentCount === n}
                    onClick={() => onChange({ agentCount: n })}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 6,
                      border: `1px solid ${settings.agentCount === n ? "#8b5cf6" : "var(--border-2)"}`,
                      background: settings.agentCount === n ? "rgba(139,92,246,0.15)" : "transparent",
                      color: settings.agentCount === n ? "#c4b5fd" : "#64748b",
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onChange({ agentCount: 1 })}
                  aria-pressed={settings.agentCount === 1}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 6,
                    border: `1px solid ${settings.agentCount === 1 ? "#8b5cf6" : "var(--border-2)"}`,
                    background: settings.agentCount === 1 ? "rgba(139,92,246,0.15)" : "transparent",
                    color: settings.agentCount === 1 ? "#c4b5fd" : "#64748b",
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  1
                </button>
              </div>
            </Field>

            <Field
              label="Model"
              hint="Blank = free tier: each agent gets a different free model automatically."
            >
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  list="model-suggestions"
                  value={settings.defaultModel}
                  onChange={(e) => onChange({ defaultModel: e.target.value })}
                  placeholder="auto (free tier pool)"
                  style={{ width: "100%" }}
                  aria-label="Model"
                />
                <button
                  type="button"
                  onClick={() => toggleFavorite(currentModel)}
                  disabled={!currentModel}
                  aria-pressed={isFavorite(currentModel)}
                  aria-label={isFavorite(currentModel) ? "Unfavorite this model" : "Favorite this model"}
                  title={isFavorite(currentModel) ? "Unfavorite this model" : "Favorite this model"}
                  style={{
                    padding: "0 10px", borderRadius: 8, flexShrink: 0,
                    border: `1px solid ${isFavorite(currentModel) ? "#f59e0b" : "var(--border-2)"}`,
                    background: isFavorite(currentModel) ? "rgba(245,158,11,0.12)" : "transparent",
                    color: isFavorite(currentModel) ? "#f59e0b" : "var(--text-3)",
                    fontSize: 14, cursor: currentModel ? "pointer" : "not-allowed",
                    opacity: currentModel ? 1 : 0.5,
                  }}
                >
                  {isFavorite(currentModel) ? "★" : "☆"}
                </button>
              </div>
              <datalist id="model-suggestions">
                {favorites.map((id) => (
                  <option key={`fav-${id}`} value={id}>
                    ★ {id}
                  </option>
                ))}
                {MODELS.filter((m) => !favorites.includes(m.id)).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.tier})
                  </option>
                ))}
              </datalist>
            </Field>

            <Field label="Run Mode">
              <button
                type="button"
                onClick={() => onChange({ demoMode: !settings.demoMode })}
                aria-pressed={settings.demoMode}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${settings.demoMode ? "#f59e0b" : "#10b981"}`,
                  background: settings.demoMode ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                  color: settings.demoMode ? "#f59e0b" : "#10b981",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {settings.demoMode ? "🧪 Demo (offline preview)" : "⚡ Live (free tier)"}
              </button>
            </Field>

            <Field label="Max Iterations">
              <input
                type="number"
                min={ITERATIONS_MIN}
                max={ITERATIONS_MAX}
                value={settings.maxIterations}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  onChange({ maxIterations: isNaN(n) ? 1 : Math.max(ITERATIONS_MIN, Math.min(ITERATIONS_MAX, n)) });
                }}
                style={{ width: "100%" }}
                aria-label="Max iterations"
              />
            </Field>

            <Field label="Round-Robin Remediation">
              <button
                type="button"
                onClick={() => onChange({ roundRobin: !settings.roundRobin })}
                aria-pressed={settings.roundRobin}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${settings.roundRobin ? "#10b981" : "var(--border-2)"}`,
                  background: settings.roundRobin ? "rgba(16,185,129,0.1)" : "transparent",
                  color: settings.roundRobin ? "#10b981" : "#64748b",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {settings.roundRobin ? "✓ Enabled" : "✗ Disabled"}
              </button>
            </Field>

            {showApiFields && (
              <>
                <Field label="API Key">
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => onChange({ apiKey: e.target.value })}
                    placeholder="sk-..."
                    autoComplete="off"
                    spellCheck={false}
                    style={{ width: "100%" }}
                    aria-label="API key"
                  />
                </Field>
                <Field label="Base URL">
                  <input
                    list="base-url-suggestions"
                    value={settings.baseUrl}
                    onChange={(e) => onChange({ baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    style={{ width: "100%" }}
                    aria-label="Base URL"
                  />
                  <datalist id="base-url-suggestions">
                    {SUGGESTED_BASE_URLS.map((u) => <option key={u} value={u} />)}
                  </datalist>
                </Field>
              </>
            )}

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex", justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={onReset}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px solid var(--border-2)",
                  background: "transparent", color: "var(--text-2)",
                  fontSize: 12,
                }}
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label
        style={{
          fontSize: 11, color: "var(--text-3)", marginBottom: 6, display: "block",
          fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
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
