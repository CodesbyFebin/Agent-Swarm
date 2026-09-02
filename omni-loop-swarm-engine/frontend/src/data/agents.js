/**
 * Agent definitions shared across the pipeline visualisation and result list.
 * Keep this list in sync with backend/prompts.py roles.
 */
export const AGENTS = [
  {
    id: "builder",
    name: "BUILDER",
    icon: "🔨",
    color: "var(--blue)",
    glow: "rgba(59, 130, 246, 0.3)",
    desc: "Generates initial solution with evidence",
  },
  {
    id: "reviewer",
    name: "REVIEWER",
    icon: "🔍",
    color: "var(--amber)",
    glow: "rgba(245, 158, 11, 0.3)",
    desc: "Gatekeeper — evaluates against requirements",
  },
  {
    id: "remediation",
    name: "REMEDIATION",
    icon: "🔧",
    color: "var(--red)",
    glow: "rgba(239, 68, 68, 0.3)",
    desc: "Fixes flaws identified by Reviewer",
  },
  {
    id: "master",
    name: "MASTER REVIEWER",
    icon: "👑",
    color: "var(--green)",
    glow: "rgba(16, 185, 129, 0.3)",
    desc: "Final authority — production approval",
  },
];

export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
