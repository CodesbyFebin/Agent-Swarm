import { AnyDomainEvent, EventStream, UUID, validateStream } from "./domain-events.js";

export type MissionStatus = "created" | "planning" | "running" | "paused" | "verifying" | "completed" | "failed" | "cancelled";
export type TaskStatus = "created" | "ready" | "running" | "completed" | "failed";
export interface MissionState { missionId: UUID; name: string; goal: string; status: MissionStatus; progress: number; tasks: Record<string, { id: UUID; title: string; status: TaskStatus; agentId?: UUID; result?: string }>; agents: Record<string, { id: UUID; name: string; role?: string; status: "running" | "stopped" }>; approvals: Record<string, { id: UUID; action: string; risk: string; status: "requested" | "granted" | "rejected" }>; verification: { id: UUID; status: "started" | "passed" | "failed"; checks: string[] } | null; artifacts: Record<string, { id: UUID; name: string; kind: string; uri?: string }>; timeline: { eventId: UUID; type: string; occurredAt: string }[]; lastSequence: number; }

export function emptyMissionState(missionId: UUID): MissionState { return { missionId, name: "", goal: "", status: "created", progress: 0, tasks: {}, agents: {}, approvals: {}, verification: null, artifacts: {}, timeline: [], lastSequence: 0 }; }
function terminal(s: MissionState) { return s.status === "completed" || s.status === "failed" || s.status === "cancelled"; }
function requireTask(s: MissionState, id: UUID) { const task = s.tasks[id]; if (!task) throw new Error(`Unknown task ${id}`); return task; }
function progress(s: MissionState) { const tasks = Object.values(s.tasks); return tasks.length ? Math.round(tasks.filter((t) => t.status === "completed").length / tasks.length * 100) : 0; }

export function applyDomainEvent(state: MissionState, event: AnyDomainEvent): MissionState {
  if (event.correlation_id !== state.missionId) throw new Error("Event correlation ID mismatch");
  if (event.sequence_number !== state.lastSequence + 1) throw new Error("Non-monotonic event sequence");
  if (terminal(state) && event.event_type !== "mission.created") throw new Error(`Cannot apply ${event.event_type} after terminal mission state`);
  const next = structuredClone(state); next.lastSequence = event.sequence_number; next.timeline.push({ eventId: event.event_id, type: event.event_type, occurredAt: event.occurred_at });
  switch (event.event_type) {
    case "mission.created": next.name = event.payload.name; next.goal = event.payload.goal; break;
    case "mission.planned": next.status = "planning"; break;
    case "task.created": next.tasks[event.payload.task_id] = { id: event.payload.task_id, title: event.payload.title, status: "created", agentId: event.payload.agent_id }; break;
    case "task.ready": requireTask(next, event.payload.task_id).status = "ready"; next.status = "running"; break;
    case "task.started": requireTask(next, event.payload.task_id).status = "running"; next.status = "running"; break;
    case "task.completed": { const t = requireTask(next, event.payload.task_id); if (t.status !== "running") throw new Error("Task must be running before completion"); t.status = "completed"; t.result = event.payload.result; next.progress = progress(next); break; }
    case "task.failed": requireTask(next, event.payload.task_id).status = "failed"; next.status = "failed"; break;
    case "agent.started": next.agents[event.payload.agent_id] = { id: event.payload.agent_id, name: event.payload.name, role: event.payload.role, status: "running" }; break;
    case "agent.stopped": next.agents[event.payload.agent_id] = { ...next.agents[event.payload.agent_id], id: event.payload.agent_id, name: next.agents[event.payload.agent_id]?.name ?? "unknown", status: "stopped" }; break;
    case "approval.requested": next.approvals[event.payload.approval_id] = { id: event.payload.approval_id, action: event.payload.action, risk: event.payload.risk, status: "requested" }; next.status = "paused"; break;
    case "approval.granted": { const a = next.approvals[event.payload.approval_id]; if (!a) throw new Error("Unknown approval"); a.status = "granted"; next.status = "running"; break; }
    case "approval.rejected": { const a = next.approvals[event.payload.approval_id]; if (!a) throw new Error("Unknown approval"); a.status = "rejected"; next.status = "failed"; break; }
    case "verification.started": next.verification = { id: event.payload.verification_id, status: "started", checks: event.payload.checks }; next.status = "verifying"; break;
    case "verification.passed": next.verification = { id: event.payload.verification_id, status: "passed", checks: event.payload.checks }; break;
    case "verification.failed": next.verification = { id: event.payload.verification_id, status: "failed", checks: [] }; next.status = "failed"; break;
    case "artifact.created": next.artifacts[event.payload.artifact_id] = { id: event.payload.artifact_id, name: event.payload.name, kind: event.payload.kind, uri: event.payload.uri }; break;
    case "mission.completed": if (next.verification?.status !== "passed" || next.verification.id !== event.payload.verification_id) throw new Error("Mission cannot complete without matching passed verification"); next.status = "completed"; next.progress = 100; break;
    case "mission.cancelled": next.status = "cancelled"; break;
    case "mission.failed": next.status = "failed"; break;
    case "tool.called": case "tool.completed": break;
  }
  return next;
}

export function replayMission(events: EventStream, missionId?: UUID): MissionState {
  if (events.length === 0) { if (!missionId) throw new Error("Mission ID is required for empty replay"); return emptyMissionState(missionId); }
  const id = missionId ?? events[0].correlation_id; validateStream(events, id); return events.reduce((state, event) => applyDomainEvent(state, event), emptyMissionState(id));
}
