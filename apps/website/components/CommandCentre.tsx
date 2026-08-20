import { APP_URL } from "@/lib/site";
import { IconArrowRight, IconCheck } from "./Icons";

const tasks = [
  ["Research requirements", "complete", "Researcher"],
  ["Design execution plan", "running", "Architect"],
  ["Security approval", "waiting", "Operator"],
  ["Verify artifacts", "queued", "QA"],
];

export function CommandCentre() {
  return (
    <section id="command-centre" className="relative border-b border-border-subtle px-6 pb-24">
      <div className="mx-auto max-w-[1180px] overflow-hidden rounded-2xl border border-border bg-[#090910] shadow-[0_40px_120px_rgba(0,0,0,.55)]">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3 text-xs text-text-muted">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green" /> COMMAND CENTRE</div>
          <span className="font-mono">MISSION / AS-1042</span>
        </div>
        <div className="grid lg:grid-cols-[220px_1fr_280px]">
          <aside className="hidden border-r border-border-subtle p-5 lg:block">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-text-muted">Workspace</p>
            <div className="mt-5 space-y-2 text-sm"><div className="rounded-md bg-orange/10 px-3 py-2 font-semibold text-orange">Mission control</div><div className="px-3 py-2 text-text-dim">Agents</div><div className="px-3 py-2 text-text-dim">Approvals</div><div className="px-3 py-2 text-text-dim">Event ledger</div></div>
          </aside>
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-orange">Live mission graph</p><h2 className="mt-2 text-2xl font-bold">Ship a governed product release</h2></div><span className="rounded-full border border-green/20 bg-green/10 px-3 py-1 text-xs font-semibold text-green">4 agents active</span></div>
            <div className="mt-7 space-y-3">{tasks.map(([task, status, agent], index) => <div key={task} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg border border-border-subtle bg-elev p-3.5"><span className={`grid h-8 w-8 place-items-center rounded-md font-mono text-xs ${status === "complete" ? "bg-green/10 text-green" : status === "running" ? "bg-orange/10 text-orange" : "bg-elev-2 text-text-muted"}`}>{status === "complete" ? <IconCheck className="h-4 w-4" /> : index + 1}</span><div><p className="text-sm font-semibold">{task}</p><p className="mt-0.5 text-xs text-text-muted">{agent}</p></div><span className="font-mono text-[10px] uppercase text-text-muted">{status}</span></div>)}</div>
          </div>
          <aside className="border-t border-border-subtle bg-elev/40 p-6 lg:border-l lg:border-t-0">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-text-muted">Human checkpoint</p><div className="mt-4 rounded-xl border border-amber/20 bg-amber/5 p-4"><p className="text-sm font-bold text-amber">Approval required</p><p className="mt-2 text-xs leading-5 text-text-dim">The security-sensitive action is paused until an operator reviews its scope.</p></div><div className="mt-6 border-t border-border-subtle pt-5"><p className="text-xs font-semibold">Evidence stream</p><div className="mt-3 space-y-2 font-mono text-[10px] text-text-muted"><p>09:41 plan.validated</p><p>09:42 task.claimed</p><p>09:44 artifact.written</p><p>09:45 approval.requested</p></div></div>
          </aside>
        </div>
      </div>
      <div className="mx-auto mt-7 flex max-w-3xl flex-col items-center text-center"><p className="text-sm leading-6 text-text-dim">The public site explains the system. The Command Centre is where you dispatch goals, review approvals, and inspect mission evidence.</p><a href={APP_URL} className="mt-5 inline-flex items-center gap-2 rounded-md bg-orange px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#d14a18]">Open app.agentswarm.in <IconArrowRight /></a></div>
    </section>
  );
}
