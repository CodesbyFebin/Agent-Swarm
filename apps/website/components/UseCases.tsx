const CASES = [
  "Architecture reports",
  "Research summaries",
  "API design proposals",
  "Security review checklists",
  "Technical documentation drafts",
  "Migration & audit plans",
];

export function UseCases() {
  return (
    <section id="use-cases" className="border-b border-border-subtle px-6 py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-orange">
            Use cases
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            What today's swarm can <span className="text-orange">actually produce</span>.
          </h2>
          <p className="mt-3 text-text-dim">
            Every succeeded task writes a real artifact. Missions currently complete when every task's artifact
            exists — deeper verification (build, test, security scan) is on the roadmap above.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {CASES.map((c) => (
            <div
              key={c}
              className="rounded-lg border border-border-subtle bg-elev px-4 py-4 text-center text-[13px] font-semibold text-text-dim transition hover:border-orange hover:text-orange"
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
