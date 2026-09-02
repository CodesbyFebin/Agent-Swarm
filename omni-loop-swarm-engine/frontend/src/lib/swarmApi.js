/**
 * Swarm API client. Wraps fetch with the same ApiError / base URL behaviour
 * the rest of the app uses.
 */
import { API_BASE } from "./api.js";
import { ApiError } from "./api.js";

async function postJson(path, body, { signal } = {}) {
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
    throw new ApiError((data && data.error) || `${res.status} ${res.statusText || "Request failed"}`, {
      status: res.status,
    });
  }
  return data;
}

export async function startSwarm({ task, constraints, api_key, model, base_url, mode, agent_count, iterations, round_robin }) {
  return postJson("/api/swarm", {
    task, constraints, api_key, model, base_url,
    mode, agent_count, iterations, round_robin,
  });
}

export async function runSwarmDemo({ task, agent_count, mode, iterations, round_robin }) {
  return postJson("/api/swarm/demo", {
    task, agent_count, mode, iterations, round_robin,
  });
}

export async function getSwarmResult(id) {
  const res = await fetch(`${API_BASE}/api/swarm/${id}/result`);
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    throw new ApiError((data && data.error) || `${res.status} ${res.statusText || "Request failed"}`, { status: res.status });
  }
  return res.json();
}

/**
 * Subscribe to SSE progress events from a swarm run.
 * Returns an `unsubscribe()` function.
 *
 * The backend's stream format:
 *   event: step
 *   data: {...step...}
 *
 *   event: done
 *   data: {...final result...}
 *
 *   event: error
 *   data: {"error": "..."}
 */
export function subscribeSwarmEvents(id, { onStep, onDone, onError, signal } = {}) {
  const es = new EventSource(`${API_BASE}/api/swarm/${id}/events`);
  es.addEventListener("step", (e) => {
    try {
      onStep && onStep(JSON.parse(e.data));
    } catch {
      // ignore malformed
    }
  });
  es.addEventListener("done", (e) => {
    try {
      onDone && onDone(JSON.parse(e.data));
    } catch {
      onError && onError(new Error("Malformed done event"));
    }
    es.close();
  });
  es.addEventListener("error", (e) => {
    if (e.data) {
      try {
        const data = JSON.parse(e.data);
        onError && onError(new ApiError(data.error || "Unknown error"));
      } catch {
        onError && onError(new Error("Connection error"));
      }
    } else if (es.readyState === EventSource.CLOSED) {
      onError && onError(new Error("Stream closed unexpectedly"));
    }
    es.close();
  });
  if (signal) {
    signal.addEventListener("abort", () => es.close());
  }
  return () => es.close();
}
