import React, { useMemo } from "react";
import { motion } from "framer-motion";

const STAGE_META = {
  build: { icon: "🔨", label: "Build" },
  arbiter: { icon: "⚖", label: "Judge" },
  remediation: { icon: "🔧", label: "Remediate" },
  rearbiter: { icon: "⚖", label: "Re-judge" },
  done: { icon: "✓", label: "Done" },
};

/**
 * Derives each stage's status ("pending" | "active" | "done" | "error")
 * from the raw SSE step log, so the diagram reflects exactly what the
 * backend actually did on this run -- not a guess about what it *should*
 * do. See backend/swarm.py's _run_swarm for the stage order this mirrors:
 * parallel build -> arbiter -> (round_robin ? remediation -> re-arbiter).
 *
 * Demo mode never emits step events (it's a synchronous, single round
 * trip -- see runSwarmDemo in lib/swarmApi.js), so there's no step log to
 * derive from there. When `demoResult` is given, every stage the mode/
 * roundRobin combination would include is just marked "done" outright,
 * using the demo result's own round_robin.done flag to decide whether the
 * remediation/re-judge stages actually ran.
 */
function deriveStages(events, mode, roundRobin, demoResult, complete) {
  if (demoResult) {
    if (mode === "single") return [{ key: "build", status: "done" }, { key: "done", status: "done" }];
    const remediationRan = roundRobin && !!demoResult.round_robin?.done;
    const stages = [
      { key: "build", status: "done" },
      { key: "arbiter", status: "done" },
    ];
    if (remediationRan) {
      stages.push({ key: "remediation", status: "done" }, { key: "rearbiter", status: "done" });
    }
    stages.push({ key: "done", status: "done" });
    return stages;
  }

  const buildSteps = events.filter((e) => e.role === "candidate_build");
  const buildError = buildSteps.some((e) => e.error);
  const buildDone = buildSteps.length > 0 && !buildError;

  if (mode === "single") {
    return [
      { key: "build", status: buildError ? "error" : buildSteps.length > 0 ? (buildDone ? "done" : "active") : "pending" },
      { key: "done", status: buildDone ? "done" : "pending" },
    ];
  }

  const arbiterSuccessIdx = events.findIndex((e) => e.role === "arbiter" && !e.error);
  const arbiterErrorSeen = events.some((e) => e.role === "arbiter" && e.error);
  const arbiterActive = events.some((e) => e.role === "arbiter" || e.role === "arbiter_delta");

  const remediationStartIdx = events.findIndex((e) => e.role === "remediation");
  const remediationActive = remediationStartIdx !== -1;
  const remediationDone = remediationActive && arbiterSuccessIdx > remediationStartIdx && arbiterSuccessIdx !== -1;

  const reArbiterActive = remediationStartIdx !== -1 &&
    events.slice(remediationStartIdx).some((e) => e.role === "arbiter" || e.role === "arbiter_delta");
  const reArbiterDone = remediationStartIdx !== -1 && arbiterSuccessIdx > remediationStartIdx;

  // Remediation only ever starts after a successful first arbiter pass, so
  // its presence alone is enough to know that pass is done -- check it
  // before the more granular success/error/active checks below.
  let arbiterStatus;
  if (remediationActive || arbiterSuccessIdx !== -1) {
    arbiterStatus = "done";
  } else if (arbiterErrorSeen) {
    arbiterStatus = "error";
  } else if (arbiterActive) {
    arbiterStatus = "active";
  } else {
    arbiterStatus = "pending";
  }

  const stages = [
    { key: "build", status: buildError ? "error" : buildDone ? "done" : buildSteps.length > 0 ? "active" : "pending" },
    { key: "arbiter", status: arbiterStatus },
  ];

  if (roundRobin) {
    stages.push({ key: "remediation", status: remediationDone ? "done" : remediationActive ? "active" : "pending" });
    stages.push({
      key: "rearbiter",
      status: reArbiterDone ? "done" : reArbiterActive ? "active" : "pending",
    });
  }

  // `complete` is the run's own authoritative "finished" signal (from
  // useSwarmRun's phase), not re-derived from the step log: remediation
  // may legitimately never start (nothing needed fixing), which the step
  // log alone can't distinguish from "hasn't started yet".
  stages.push({ key: "done", status: complete ? "done" : "pending" });
  return stages;
}

const STATUS_STYLE = {
  pending: { border: "var(--border-1)", bg: "var(--bg-3)", color: "var(--text-4)" },
  active: { border: "#8b5cf6", bg: "rgba(139,92,246,0.12)", color: "#c4b5fd" },
  done: { border: "#10b981", bg: "rgba(16,185,129,0.1)", color: "#10b981" },
  error: { border: "#ef4444", bg: "rgba(239,68,68,0.1)", color: "#f87171" },
};

export default function AgentFlowDiagram({ events, mode, roundRobin, complete, demoResult }) {
  const stages = useMemo(
    () => deriveStages(events, mode, roundRobin, demoResult, complete),
    [events, mode, roundRobin, demoResult, complete]
  );

  return (
    <div
      role="img"
      aria-label={`Pipeline flow: ${stages.map((s) => `${STAGE_META[s.key].label} (${s.status})`).join(" then ")}`}
      style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
        marginBottom: 20, padding: "12px 16px",
        background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: "var(--radius-lg)",
      }}
    >
      {stages.map((stage, i) => {
        const meta = STAGE_META[stage.key];
        const style = STATUS_STYLE[stage.status];
        return (
          <React.Fragment key={stage.key}>
            {i > 0 && (
              <span aria-hidden style={{ color: "var(--text-4)", fontSize: 14, flexShrink: 0 }}>
                →
              </span>
            )}
            <motion.div
              animate={stage.status === "active" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={stage.status === "active" ? { duration: 1.2, repeat: Infinity } : {}}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 8,
                border: `1.5px solid ${style.border}`, background: style.bg,
                fontSize: 12, fontWeight: 700, color: style.color,
                whiteSpace: "nowrap",
              }}
            >
              <span aria-hidden>{stage.status === "done" ? "✓" : stage.status === "error" ? "✕" : meta.icon}</span>
              {meta.label}
            </motion.div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
