const LIVE = [
  "Mission → task DAG → agent execution, backend-authoritative end to end",
  "Real auth: bcrypt password hashing, DB-backed sessions, org/project/role tenancy",
  "Approval gates that genuinely block execution until an operator decides",
  "SSE event stream with durable replay from a persisted, sequenced ledger",
  "Postgres-authoritative dispatch with Redis/BullMQ as a coordination layer, not a truth source",
  "A verification gate that checks real artifact existence before COMPLETED",
];

const ROADMAP = [
  "MCP tool registry and gateway",
  "Sandboxed / isolated task workspaces",
  "Persistent memory and reusable skills",
  "Scheduler for recurring or webhook-triggered missions",
  "Cost engine backed by real provider-reported usage",
  "Richer verification gates (build, typecheck, security scan, accessibility)",
];

export function Truth() {
  return (
    <section id="truth" className="border-b border-border-subtle px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-orange">
            Truth doctrine
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            We don't say <span className="text-orange">LIVE</span> unless it's live.
          </h2>
          <p className="mt-3 text-text-dim">
            AgentSwarm's own runtime uses explicit states — LIVE, CONFIGURED, UNAVAILABLE, UNKNOWN — instead of
            guessing. This page follows the same rule.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-green/25 bg-green/5 p-7">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green">
              <span className="h-2 w-2 rounded-full bg-green" /> Shipped &amp; verified
            </h3>
            <ul className="flex flex-col gap-3 text-sm leading-relaxed text-text-dim">
              {LIVE.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-1 text-green">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border-subtle bg-elev p-7">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-text-muted">
              <span className="h-2 w-2 rounded-full bg-text-muted" /> Roadmap — not yet live
            </h3>
            <ul className="flex flex-col gap-3 text-sm leading-relaxed text-text-dim">
              {ROADMAP.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-1 text-text-muted">○</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
