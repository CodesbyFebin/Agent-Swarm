import { useCallback, useEffect, useRef, useState } from "react";
import {
  runSwarmDemo,
  startSwarm,
  subscribeSwarmEvents,
} from "../lib/swarmApi.js";
import { ApiError } from "../lib/api.js";

/**
 * Owns the swarm run lifecycle.
 *
 *   idle → submitting → running → complete | error
 *
 * For DEMO mode the demo endpoint is synchronous and the result is returned
 * in one round trip. For LIVE mode we POST to /api/swarm, get back a run id,
 * then open an SSE stream to /api/swarm/{id}/events for live progress.
 *
 * `events` is an append-only array of step events the UI can render as a
 * live activity log; the authoritative result lands in `result` on completion.
 */
export function useSwarmRun() {
  const [phase, setPhase] = useState("idle"); // idle | submitting | running | complete | error
  const [events, setEvents] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  // The arbiter's reasoning, growing as `arbiter_delta` SSE events arrive
  // (see backend/swarm.py's stream_llm-backed arbiter call). Kept separate
  // from `events` so it doesn't get diffed against other step types, and
  // so a chatty stream of small chunks doesn't bloat the events log.
  const [liveArbiterText, setLiveArbiterText] = useState("");

  const unsubscribeRef = useRef(null);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setPhase("idle");
    setEvents([]);
    setResult(null);
    setError(null);
    setProgress(0);
    setLiveArbiterText("");
  }, []);

  useEffect(() => () => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const run = useCallback(async (params) => {
    reset();
    setPhase("submitting");
    setProgress(5);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (params.demo) {
        // Demo path: synchronous, one round trip.
        setProgress(40);
        const data = await runSwarmDemo({
          task: params.task,
          agent_count: params.agentCount,
          mode: params.mode,
          iterations: params.iterations,
          round_robin: params.roundRobin,
        });
        setProgress(100);
        setResult(data);
        setPhase("complete");
        return data;
      }

      // Live path: start a run, then subscribe to its events.
      const start = await startSwarm({
        task: params.task,
        constraints: params.constraints,
        api_key: params.apiKey,
        model: params.model,
        base_url: params.baseUrl,
        mode: params.mode,
        agent_count: params.agentCount,
        iterations: params.iterations,
        round_robin: params.roundRobin,
      });
      setProgress(15);
      setPhase("running");

      const final = await new Promise((resolve, reject) => {
        const unsub = subscribeSwarmEvents(start.id, {
          signal: controller.signal,
          onStep: (step) => {
            if (step.role === "arbiter_delta") {
              setLiveArbiterText(step.payload?.accumulated ?? "");
              setProgress((p) => Math.min(95, p + 0.5));
              return;
            }
            setEvents((prev) => [...prev, step]);
            setProgress((p) => Math.min(95, p + 8));
          },
          onDone: (data) => {
            setProgress(100);
            setResult(data);
            setPhase("complete");
            unsub();
            resolve(data);
          },
          onError: (err) => {
            setError(err.message || "Unknown error");
            setPhase("error");
            unsub();
            reject(err);
          },
        });
        unsubscribeRef.current = unsub;
      });
      return final;
    } catch (err) {
      if (err.name === "AbortError") return null;
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || "Unknown error");
      }
      setPhase("error");
      return null;
    } finally {
      abortRef.current = null;
    }
  }, [reset]);

  return {
    phase,
    events,
    result,
    error,
    progress,
    liveArbiterText,
    run,
    reset,
    isRunning: phase === "submitting" || phase === "running",
  };
}
