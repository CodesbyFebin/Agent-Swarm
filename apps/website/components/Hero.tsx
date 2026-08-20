import { APP_URL } from "@/lib/site";
import { IconArrowRight } from "./Icons";

const TRUST = ["Human approval gates", "Real event ledger", "Postgres-authoritative", "Multi-tenant by design"];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border-subtle px-6 pb-20 pt-24 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at top, rgba(255,90,31,0.08) 0%, transparent 60%)" }}
      />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange/30 bg-orange/10 px-3.5 py-1.5 text-xs font-semibold text-orange">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange" />
          LIVE MVP · AUTH + TENANCY + DURABLE DISPATCH SHIPPED
        </div>
        <h1 className="text-balance text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-[1.02] tracking-[-0.045em]">
          Command your AI workforce. <span className="text-orange">Keep humans in control.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-text-dim">
          Give AgentSwarm a goal. It plans the mission, routes work across specialist agents, pauses consequential
          actions for approval, and records every state change in a replayable event ledger.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <a
            href={APP_URL}
            className="inline-flex items-center gap-2 rounded-md bg-orange px-6 py-3.5 text-[15px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#d14a18]"
          >
            Launch AgentSwarm <IconArrowRight />
          </a>
          <a
            href="#platform"
            className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3.5 text-[15px] font-semibold text-text-dim transition hover:border-border-strong hover:text-text"
          >
            Explore the control plane
          </a>
        </div>
        <p className="mt-4 text-xs text-text-muted">Opens the secure Command Centre at app.agentswarm.in</p>
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-text-muted">
          {TRUST.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
