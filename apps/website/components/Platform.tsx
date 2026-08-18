import { IconCheck, IconGrid, IconQueue, IconRoute, IconShield, IconStream, IconUsers } from "./Icons";

const FEATURES = [
  {
    icon: IconGrid,
    title: "Dynamic mission planning",
    body: "The planner calls a real model to decompose a goal into a dependency-aware task graph — 3 to 12 tasks, cycle-checked, validated with Zod before anything is persisted. No hard-coded task lists.",
  },
  {
    icon: IconUsers,
    title: "Eight specialist agents",
    body: "Planner, researcher, architect, backend, frontend, QA, security, and DevOps — each task is assigned to the specialist whose role matches the work.",
  },
  {
    icon: IconRoute,
    title: "Model routing",
    body: "A provider-neutral adapter talks to any OpenAI-compatible endpoint (shipped with Qwen). Unconfigured providers block missions honestly as BLOCKED — never simulated as running.",
  },
  {
    icon: IconShield,
    title: "Governed approvals",
    body: "Tasks can declare requiresApproval and a risk level. The task genuinely stops in WAITING_APPROVAL until an operator with OPERATOR-level role or above decides — approve resumes, reject fails the mission.",
  },
  {
    icon: IconStream,
    title: "Real-time event ledger",
    body: "Every state change is a persisted, sequenced event. Server-Sent Events stream them live via Postgres LISTEN/NOTIFY, with durable backlog replay on reconnect — not a client-side timer pretending to be progress.",
  },
  {
    icon: IconQueue,
    title: "Durable dispatch",
    body: "Postgres row-level locking (FOR UPDATE SKIP LOCKED) is the sole authority on task claims. Redis/BullMQ adds a low-latency wake-up signal on top, with a Postgres-only fallback poll — verified to survive a real Redis outage and a worker crash mid-backlog.",
  },
];

export function Platform() {
  return (
    <section id="platform" className="border-b border-border-subtle px-6 py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-orange">
            Platform
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            What's actually running <span className="text-orange">today</span>.
          </h2>
          <p className="mt-3 text-text-dim">
            Every item below is implemented and has been exercised end to end — including deliberately breaking
            it (killing Redis mid-mission, crashing the worker) to confirm it recovers correctly.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-xl border border-border-subtle bg-elev p-7 transition hover:-translate-y-0.5 hover:border-border-strong"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-orange/10 text-orange">
                <Icon className="h-[22px] w-[22px]" />
              </div>
              <h3 className="mb-2 text-[17px] font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-text-dim">{body}</p>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-2 text-center text-xs text-text-muted">
          <IconCheck className="h-3.5 w-3.5 shrink-0 text-green" />
          Real auth (bcrypt + DB-backed sessions) and org/project tenancy with role-based access ship alongside
          all of this — cross-organization access returns a genuine 404, not just a hidden UI element.
        </p>
      </div>
    </section>
  );
}
