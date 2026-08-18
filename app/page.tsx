"use client"

import { useEffect, useMemo, useState } from "react"

type Mission = { id: string; name: string; goal: string; status: string; truth: string; sequence: number; taskIds: string[]; agentIds: string[]; verificationId?: string }
type EventRow = { sequence_number: number; event_type: string; occurred_at: string; payload: Record<string, unknown> }

const nav = ["Command Centre", "Swarms", "Tasks", "Agents", "Approvals", "Evidence", "Artifacts", "Costs", "Models", "Memory", "Skills", "MCP / Tools"]

export default function Home() {
  const [mission, setMission] = useState<Mission | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [goal, setGoal] = useState("")
  const [showComposer, setShowComposer] = useState(false)
  const [view, setView] = useState("Command Centre")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [connected, setConnected] = useState(false)

  const refresh = async (id: string) => {
    const response = await fetch(`/api/v1/missions?id=${id}`, { cache: "no-store" })
    if (!response.ok) throw new Error("Unable to load mission")
    const data = await response.json()
    setMission(data.mission)
    setEvents(data.events)
  }

  useEffect(() => {
    const stored = document.cookie.match(/agentswarm_mission=([^;]+)/)?.[1]
    if (stored) refresh(stored).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!mission) return
    const stream = new EventSource(`/api/v1/missions/events?id=${mission.id}&after=${mission.sequence}`)
    stream.onopen = () => setConnected(true)
    stream.onmessage = (message) => {
      const event = JSON.parse(message.data) as EventRow
      setEvents((current) => current.some((item) => item.sequence_number === event.sequence_number) ? current : [...current, event])
      refresh(mission.id).catch(() => undefined)
    }
    stream.onerror = () => setConnected(false)
    return () => stream.close()
  }, [mission?.id, mission?.sequence])

  const create = async () => {
    if (!goal.trim()) return
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/v1/missions", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ name: goal.trim().slice(0, 48), goal: goal.trim() }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message ?? "Mission creation failed")
      document.cookie = `agentswarm_mission=${data.mission.id}; path=/; max-age=86400`
      setMission(data.mission); setEvents(data.events); setGoal(""); setShowComposer(false)
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create mission") } finally { setBusy(false) }
  }

  const command = async (action: string) => {
    if (!mission) return
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/v1/missions", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ id: mission.id, action }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message ?? "Command rejected")
      setMission(data.mission); setEvents(data.events)
    } catch (e) { setError(e instanceof Error ? e.message : "Command rejected") } finally { setBusy(false) }
  }

  const progress = useMemo(() => mission?.status === "COMPLETED" ? 100 : mission?.status === "VERIFYING" ? 82 : mission?.status === "RUNNING" ? 58 : mission?.status === "PLANNING" ? 22 : 0, [mission])
  return <main className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/95 px-5 backdrop-blur">
      <div className="flex items-center gap-3"><div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">◈</div><span className="font-bold">Agent<span className="text-primary">Swarm</span></span><span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">Live projection</span><span className={`hidden items-center gap-1.5 font-mono text-[10px] sm:flex ${connected ? "text-success" : "text-muted"}`}><i className={`size-1.5 rounded-full ${connected ? "bg-success" : "bg-muted"}`} /> {connected ? "Event stream" : "Ledger polling"}</span></div>
      <div className="flex items-center gap-2"><kbd className="hidden rounded border border-border px-2 py-1 font-mono text-[10px] text-muted sm:block">⌘ K</kbd><button onClick={() => setShowComposer(true)} className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">+ New mission</button></div>
    </header>
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[210px_1fr_280px]">
      <aside className="hidden min-h-[calc(100vh-56px)] border-r border-border bg-card p-3 lg:block">{["Workspace", "Observe", "System"].map((group, i) => <div key={group} className="mb-5"><div className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-muted">{group}</div>{nav.slice(i * 4, i * 4 + 4).map(item => <button key={item} onClick={() => setView(item)} className={`flex w-full items-center gap-2 rounded-md border-l-2 px-3 py-2 text-left text-xs font-semibold ${view === item ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted hover:bg-muted/10"}`}><span className="font-mono text-[11px]">◫</span>{item}</button>)}</div>)}</aside>
      <section className="min-w-0 p-5 md:p-7"><div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-extrabold tracking-tight md:text-2xl">{mission?.name ?? view}</h1>{mission && <span className="rounded-full border border-success/30 bg-success/10 px-2 py-1 font-mono text-[10px] font-bold text-success">{mission.truth} / {mission.status}</span>}</div><p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{mission?.goal ?? "The control plane for governed AI workforces."}</p></div>{mission && <div className="flex gap-2"><button disabled={busy} onClick={() => command("plan")} className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:border-primary disabled:opacity-50">Plan</button><button disabled={busy} onClick={() => command("start")} className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">Advance mission</button></div>}</div>
        {error && <div role="alert" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}
        {!mission ? <Empty onCreate={() => setShowComposer(true)} /> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Mission state" value={mission.status} sub={mission.truth} /><Kpi label="Progress" value={`${progress}%`} sub={`${mission.sequence} ledger events`} /><Kpi label="Tasks" value={String(mission.taskIds.length)} sub="Backend planned" /><Kpi label="Agents" value={String(mission.agentIds.length)} sub="Runtime assigned" /></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]"><Panel title="Execution timeline" events={events} /><Panel title="Evidence ledger" events={events.filter((event) => event.event_type.includes("evidence") || event.event_type.includes("verification"))} /></div></>}
      </section>
      <aside className="hidden border-l border-border bg-card p-5 xl:block"><div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-widest text-muted">Inspector</h2><span className="font-mono text-[10px] text-muted">SEQ {mission?.sequence ?? 0}</span></div><div className="mt-5 rounded-lg border border-border bg-background p-4"><div className="font-mono text-[10px] uppercase text-muted">Authority</div><p className="mt-2 text-sm leading-6">PostgreSQL event ledger is authoritative. The browser is a projection only.</p></div><div className="mt-3 rounded-lg border border-border p-4"><div className="font-mono text-[10px] uppercase text-muted">Latest event</div><p className="mt-2 font-mono text-xs text-primary">{events.at(-1)?.event_type ?? "NOT_RUN"}</p></div></aside>
    </div>
    {showComposer && <div className="fixed inset-0 z-30 grid place-items-center bg-background/80 p-5 backdrop-blur-sm"><div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Start a governed mission</h2><p className="mt-1 text-sm text-muted">The backend will own planning, execution, evidence, and verification.</p></div><button aria-label="Close" onClick={() => setShowComposer(false)} className="text-muted hover:text-foreground">×</button></div><textarea autoFocus value={goal} onChange={(event) => setGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); create() } }} placeholder="What needs to get done?" className="mt-5 min-h-32 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none placeholder:text-muted focus:border-primary" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowComposer(false)} className="rounded-md border border-border px-4 py-2 text-xs font-semibold">Cancel</button><button disabled={busy || !goal.trim()} onClick={create} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy ? "Creating…" : "Create mission"}</button></div></div></div>}
  </main>
}
function Empty({ onCreate }: { onCreate: () => void }) { return <div className="grid min-h-[55vh] place-items-center text-center"><div><div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-primary/10 text-3xl text-primary">◈</div><h2 className="text-2xl font-extrabold">No active mission</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Create a mission and watch the backend-authoritative lifecycle appear as replayable events.</p><button onClick={onCreate} className="mt-6 rounded-md bg-primary px-4 py-3 text-xs font-bold text-primary-foreground">Create mission</button></div></div> }
function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) { return <div className="rounded-lg border border-border bg-card p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div><div className="mt-2 font-mono text-xl font-extrabold">{value}</div><div className="mt-1 text-[11px] text-success">{sub}</div></div> }
function Panel({ title, events }: { title: string; events: EventRow[] }) { return <div className="rounded-lg border border-border bg-card p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><span className="font-mono text-[10px] text-muted">{events.length} records</span></div>{events.length === 0 ? <p className="mt-6 text-sm text-muted">No authoritative records yet.</p> : <div className="mt-5 space-y-3">{events.slice(-6).reverse().map(event => <div key={`${event.sequence_number}-${event.event_type}`} className="flex items-center justify-between gap-3 border-b border-border/70 pb-3"><div><div className="font-mono text-xs text-primary">{event.event_type}</div><div className="mt-1 text-[11px] text-muted">{new Date(event.occurred_at).toLocaleTimeString()}</div></div><span className="font-mono text-[10px] text-muted">#{event.sequence_number}</span></div>)}</div>}</div> }
