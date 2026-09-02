import { useEffect, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage.js";

/**
 * Settings that should survive a page reload. The API key is stored in
 * localStorage but never logged, displayed, or sent anywhere except the
 * user's own backend for a single POST.
 */
const KEY = "settings";

const DEFAULTS = {
  apiKey: "",
  model: "gpt-4o",
  baseUrl: "https://api.openai.com/v1",
  demoMode: true,
  maxLoops: 3, // visual hint only; backend's MAX_REMEDIATION_LOOPS is authoritative
};

export function usePersistedSettings() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...loadJSON(KEY, {}) }));

  useEffect(() => {
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
