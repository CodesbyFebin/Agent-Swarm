import { useCallback, useEffect, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage.js";

const KEY = "swarm-history";
const MAX = 20;

/**
 * Last N swarm runs. Each entry is a compact summary that includes the
 * winner's output so the user can re-grab it without re-running.
 */
export function useSwarmHistory() {
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
          mode: entry.mode,
          agentCount: entry.agentCount,
          roundRobin: !!entry.roundRobin,
          winnerId: entry.winnerId,
          finalOutput: entry.finalOutput,
          arbiterConfidence: entry.arbiterConfidence,
          tokens: entry.tokens || {},
          duration: entry.duration || 0,
        },
        ...prev,
      ];
      return next.slice(0, MAX);
    });
  }, []);

  const clear = useCallback(() => setHistory([]), []);
  const remove = useCallback((id) => setHistory((prev) => prev.filter((e) => e.id !== id)), []);

  /**
   * Merge externally-supplied entries (e.g. from an imported file) into the
   * current history. De-duplicates by id, newest first, capped at MAX --
   * matches `add`'s own invariants so imported and organically-created
   * entries are indistinguishable afterwards.
   */
  const importEntries = useCallback((entries) => {
    if (!Array.isArray(entries)) {
      throw new Error("Expected a JSON array of history entries");
    }
    const valid = entries.filter(
      (e) => e && typeof e === "object" && typeof e.id === "string" && typeof e.task === "string"
    );
    if (valid.length === 0) {
      throw new Error("No valid history entries found in the file");
    }
    let importedCount = 0;
    setHistory((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      const additions = valid.filter((e) => !seen.has(e.id));
      importedCount = additions.length;
      const merged = [...additions, ...prev];
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return merged.slice(0, MAX);
    });
    return importedCount;
  }, []);

  return { history, add, clear, remove, importEntries };
}
