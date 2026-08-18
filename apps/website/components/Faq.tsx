const FAQS = [
  {
    q: "What is AgentSwarm?",
    a: "AgentSwarm is a control plane for AI workforces: you describe a goal, a backend-authoritative planner decomposes it into a dependency-aware task graph, specialist agents execute tasks against a real model provider, consequential actions require human approval, and every state change is a persisted, replayable event.",
  },
  {
    q: "Is the mission execution actually real, or a demo?",
    a: "It's real. There is no client-side timer or random-number engine driving progress. Postgres holds authoritative mission/task state, a worker leases and executes tasks with FOR UPDATE SKIP LOCKED, and the browser only ever renders what the backend actually persisted — verified by deliberately creating missions during a real Redis outage and a killed worker process, and confirming no lost or duplicated work.",
  },
  {
    q: "What happens if a model provider isn't configured?",
    a: "The mission is persisted and then honestly moves to BLOCKED with provider status UNAVAILABLE. It is never simulated as running or completed.",
  },
  {
    q: "How does approval actually work?",
    a: "A task can declare requiresApproval and a risk level. When the worker reaches it, the task genuinely stops in WAITING_APPROVAL and a persisted approval record is created. Deciding requires OPERATOR role or above in that mission's organization — approving resumes the exact task, rejecting fails the mission. There's no optimistic client-side approval.",
  },
  {
    q: "Is there real multi-tenancy?",
    a: "Yes. Every mission belongs to exactly one organization and project, assigned server-side from a verified membership check. A user outside that organization gets a genuine 404 on the mission — not a hidden UI element with the data still reachable underneath.",
  },
  {
    q: "What isn't built yet?",
    a: "MCP tool registry, sandboxed task workspaces, persistent memory and skills, a scheduler, a real cost engine, and richer verification gates (build/typecheck/security). These are on the public roadmap above, not claimed as live.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export function Faq() {
  return (
    <section id="faq" className="border-b border-border-subtle px-6 py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-orange">FAQ</span>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Direct answers about <span className="text-orange">AgentSwarm</span>.
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-lg border border-border-subtle bg-elev px-6 py-1 open:pb-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[15px] font-semibold marker:content-none">
                {q}
                <span className="ml-4 shrink-0 text-lg text-text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="text-sm leading-relaxed text-text-dim">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
