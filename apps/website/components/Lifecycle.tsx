const STEPS = ["Intent", "Plan", "Route", "Execute", "Approve", "Verify"];

export function Lifecycle() {
  return (
    <section className="border-b border-border-subtle px-6 py-16">
      <div className="mx-auto max-w-5xl text-center">
        <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-orange">
          Execution architecture
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight">
          Intent to evidence, with every <span className="text-orange">boundary visible</span>.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-text-dim">
          Planning is separated from execution, and execution from verification — the backend, never the
          browser, owns what actually happened.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-elev px-4 py-3 text-sm font-semibold"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-orange text-[11px] font-bold text-white">
                {i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
