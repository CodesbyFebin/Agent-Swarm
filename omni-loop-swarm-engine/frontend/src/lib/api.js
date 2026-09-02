/**
 * Tiny helpers for talking to the backend.
 */
const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  "";

export const API_BASE = RAW_BASE || "http://localhost:5000";

export class ApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function postJson(path, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(
      `Could not reach the backend at ${API_BASE}. Is it running? (cd backend && python app.py)`,
    );
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // not JSON
  }

  if (!res.ok) {
    const message =
      (data && data.error) || `${res.status} ${res.statusText || "Request failed"}`;
    throw new ApiError(message, { status: res.status });
  }

  return data;
}

export async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new ApiError(`${res.status} ${res.statusText || "Request failed"}`);
  }
  return res.json();
}
