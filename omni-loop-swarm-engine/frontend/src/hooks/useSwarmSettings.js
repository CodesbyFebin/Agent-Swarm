import { useEffect, useRef, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage.js";

/**
 * Settings for the swarm UI. Persisted to localStorage.
 *
 * Fix vs the previous version: we compare incoming state against the previous
 * value and only write to localStorage when something actually changed.
 * The previous version wrote on every mount, even before the user touched
 * anything, which would have clobbered any out-of-band edits.
 */
const KEY = "swarm-settings";

const DEFAULTS = Object.freeze({
  mode: "swarm",
  agentCount: 4,
  maxIterations: 3,
  // Blank = free tier: the backend assigns each candidate a distinct model
  // from its Kilo Gateway free pool automatically. Fill in a specific model
  // (with an api_key/baseUrl) to bring your own provider instead.
  defaultModel: "",
  roundRobin: true,
  apiKey: "",
  baseUrl: "",
  // Explicit toggle for the deterministic, offline preview pipeline.
  // Independent of whether an API key is set -- previously demo mode was
  // forced on whenever apiKey was blank, which made it impossible to ever
  // reach a live run without first typing a key (and the free tier never
  // needs one).
  demoMode: false,
});

function loadInitial() {
  const stored = loadJSON(KEY, {});
  const merged = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (k in stored) merged[k] = stored[k];
  }
  // Sanitise: clamp agentCount/iterations to legal ranges.
  merged.agentCount = Math.max(1, Math.min(6, Number(merged.agentCount) || DEFAULTS.agentCount));
  merged.maxIterations = Math.max(1, Math.min(10, Number(merged.maxIterations) || DEFAULTS.maxIterations));
  if (typeof merged.roundRobin !== "boolean") merged.roundRobin = DEFAULTS.roundRobin;
  if (typeof merged.demoMode !== "boolean") merged.demoMode = DEFAULTS.demoMode;
  if (typeof merged.apiKey !== "string") merged.apiKey = "";
  if (typeof merged.baseUrl !== "string") merged.baseUrl = DEFAULTS.baseUrl;
  if (!merged.mode || !["single", "swarm", "arbiter"].includes(merged.mode)) {
    merged.mode = DEFAULTS.mode;
  }
  if (typeof merged.defaultModel !== "string") {
    merged.defaultModel = DEFAULTS.defaultModel;
  }
  return merged;
}

export function useSwarmSettings() {
  const [settings, setSettings] = useState(loadInitial);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveJSON(KEY, settings);
  }, [settings]);

  function update(patch) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function reset() {
    setSettings({ ...DEFAULTS });
  }

  return [settings, update, reset];
}
