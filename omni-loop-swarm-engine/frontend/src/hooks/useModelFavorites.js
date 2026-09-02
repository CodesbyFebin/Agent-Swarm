import { useCallback, useEffect, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage.js";

const KEY = "favorite-models";
const MAX = 20;

/**
 * Starred model ids, persisted to localStorage. Favoriting a model (free-tier
 * id, or one you've typed in for your own provider) surfaces it at the top
 * of the Model field's suggestions next time, instead of re-typing it.
 */
export function useModelFavorites() {
  const [favorites, setFavorites] = useState(() => loadJSON(KEY, []));

  useEffect(() => {
    saveJSON(KEY, favorites);
  }, [favorites]);

  const isFavorite = useCallback((modelId) => favorites.includes(modelId), [favorites]);

  const toggleFavorite = useCallback((modelId) => {
    const id = (modelId || "").trim();
    if (!id) return;
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [id, ...prev].slice(0, MAX)
    );
  }, []);

  const removeFavorite = useCallback((modelId) => {
    setFavorites((prev) => prev.filter((m) => m !== modelId));
  }, []);

  return { favorites, isFavorite, toggleFavorite, removeFavorite };
}
