import type { Metadata } from "next";
import { APP_URL, REPO_URL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "AgentSwarm Documentation", description: "Start with AgentSwarm architecture, mission execution, approvals, event-ledger behavior, and self-hosting resources.", alternates: { canonical: `${SITE_URL}/docs` } };

const resources = [
  ["Architecture", "Understand the API, worker, PostgreSQL authority, Redis wake-up path, and web control plane."],
  ["Mission lifecycle", "Follow a goal from validated plan through dependency-aware tasks, approvals, results, and audit events."],
  ["Security model", "Review tenancy boundaries, role checks, secrets handling, approvals, and operational threat assumptions."],
  ["Self-hosting", "Run the repository locally and configure supported OpenAI-compatible model providers."],
];

export default function DocsPage() {
  return <main className="min-h-screen px-6 py-20"><div className="mx-auto max-w-5xl"><a href="/" className="text-sm font-semibold text-orange">← AgentSwarm.in</a><p className="mt-14 font-mono text-xs uppercase tracking-[.22em] text-orange">Documentation hub</p><h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight md:text-6xl">Operate a swarm you can explain.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-text-dim">AgentSwarm separates orchestration claims from observable implementation. Start with the system model, then inspect the source and run it in your environment.</p><div className="mt-12 grid gap-5 md:grid-cols-2">{resources.map(([title, body]) => <section key={title} className="rounded-xl border border-border-subtle bg-elev p-7"><h2 className="text-xl font-bold">{title}</h2><p className="mt-3 leading-7 text-text-dim">{body}</p></section>)}</div><div className="mt-10 flex flex-wrap gap-3"><a className="rounded-md bg-orange px-5 py-3 font-bold text-white" href={REPO_URL}>Read source on GitHub</a><a className="rounded-md border border-border px-5 py-3 font-semibold" href={APP_URL}>Open Command Centre</a><a className="rounded-md border border-border px-5 py-3 font-semibold" href={`${SITE_URL}/llms-full.txt`}>LLM-readable reference</a></div></div></main>;
}
