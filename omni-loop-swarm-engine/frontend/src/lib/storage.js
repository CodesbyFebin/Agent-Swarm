/**
 * Tiny localStorage wrapper with namespacing and a safety net.
 */
const NS = "omni-loop:";

const isAvailable = (() => {
  try {
    const k = `${NS}__test__`;
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

export function loadJSON(key, fallback) {
  if (!isAvailable) return fallback;
  try {
    const raw = localStorage.getItem(NS + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  if (!isAvailable) return;
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function removeKey(key) {
  if (!isAvailable) return;
  try {
    localStorage.removeItem(NS + key);
  } catch {
    // ignore
  }
}
