import { useCallback, useEffect, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage.js";

const KEY = "history";
const MAX = 20;

/**
 * Keeps the last N pipeline runs in localStorage so users can revisit them
 * without re-running. Each entry is a compact summary; the full `final_output`
 * is kept because users usually want to copy/paste it.
 */
export function useRunHistory() {
  const [history, setHistory] = useState(() => loadJSON(KEY, []));

  useEffect(() => {
    saveJSON(KEY, history);
  }, [history]);

  const add = useCallback((entry) => {
    setHistory((prev) => {
      const next = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          task: entry.task,
          approval: entry.approval || "DENIED",
          loopCount: entry.loopCount || 0,
          model: entry.model || "demo",
          tokens: entry.tokens || {},
          duration: entry.duration || 0,
          finalOutput: entry.finalOutput || "",
          builderEvidence: entry.builderEvidence || "",
          reviewerEvidence: entry.reviewerEvidence || "",
          reviewerDecision: entry.reviewerDecision || "",
          remediationEvidence: entry.remediationEvidence || "",
          masterEvidence: entry.masterEvidence || "",
        },
        ...prev,
      ];
      return next.slice(0, MAX);
    });
  }, []);

  const clear = useCallback(() => setHistory([]), []);

  const remove = useCallback((id) => {
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { history, add, clear, remove };
}
