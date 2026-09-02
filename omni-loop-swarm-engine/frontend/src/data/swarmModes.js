/**
 * Mode definitions for the swarm orchestrator.
 * Matches backend/swarm.py mode validation.
 */
export const SWARM_MODES = [
  { id: "single", label: "Single", icon: "◉", desc: "One agent, direct output" },
  { id: "swarm", label: "Swarm", icon: "⬡", desc: "Parallel agents, round-robin" },
  { id: "arbiter", label: "Arbiter", icon: "⚖", desc: "Swarm + arbitration gate" },
];

export const SWARM_MODE_BY_ID = Object.fromEntries(SWARM_MODES.map((m) => [m.id, m]));

/**
 * Agent colors. Up to 6 — matches backend clamp.
 * Names are kept in the backend too, but having them here means the UI can
 * render the agent's color before the first event arrives.
 */
export const AGENT_COLORS = [
  { name: "Alpha",   bg: "#3b82f6", glow: "rgba(59,130,246,0.4)" },
  { name: "Beta",    bg: "#8b5cf6", glow: "rgba(139,92,246,0.4)" },
  { name: "Gamma",   bg: "#06b6d4", glow: "rgba(6,182,212,0.4)" },
  { name: "Delta",   bg: "#f59e0b", glow: "rgba(245,158,11,0.4)" },
  { name: "Epsilon", bg: "#ec4899", glow: "rgba(236,72,153,0.4)" },
  { name: "Zeta",    bg: "#10b981", glow: "rgba(16,185,129,0.4)" },
];

/** Backend accepts 1..6 agents, 1..10 iterations. */
export const AGENT_COUNT_OPTIONS = [2, 3, 4, 5, 6];
export const AGENT_COUNT_MIN = 1;
export const AGENT_COUNT_MAX = 6;
export const ITERATIONS_MIN = 1;
export const ITERATIONS_MAX = 10;

export const SAMPLE_TASKS = [
  "Write a Python function to find the longest palindromic substring",
  "Design a REST API schema for a multi-tenant SaaS platform",
  "Create a React component for an infinite scroll feed with virtualization",
  "Generate a SQL query to find top 3 customers per region by revenue",
];
