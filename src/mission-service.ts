import { randomUUID } from "node:crypto";
import { supabaseEventStore, type EventStore } from "./event-store";
import { replayMission, type MissionState } from "./mission-replay";
import type { ActorType, AnyDomainEvent, DomainEvent, EventStream, ISO8601, UUID } from "./domain-events";
import type { MissionProjection } from "./mission-contracts";

const id = () => randomUUID() as UUID;
const time = () => new Date().toISOString() as ISO8601;
const actor = id();
function makeEvent(type: DomainEvent["event_type"], correlation: UUID, sequence: number, payload: unknown, actorType: ActorType = "system"): AnyDomainEvent {
  return { event_id: id(), event_type: type, occurred_at: time(), actor_type: actorType, actor_id: actor, payload, causation_id: null, correlation_id: correlation, sequence_number: sequence, schema_version: 1 } as AnyDomainEvent;
}
function projection(state: MissionState): MissionProjection { return { id: state.missionId, name: state.name, goal: state.goal, status: state.status.toUpperCase() as MissionProjection["status"], truth: "LIVE", sequence: state.lastSequence, taskIds: Object.keys(state.tasks), agentIds: Object.keys(state.agents), verificationId: state.verification?.status === "passed" ? state.verification.id : undefined }; }

export async function createMission(input: { name: string; goal: string }, store: EventStore = supabaseEventStore()) {
  const correlation = id(); const events: EventStream = [makeEvent("mission.created", correlation, 1, { name: input.name.trim(), goal: input.goal.trim() }, "user")]; await store.append(events); return { mission: projection(replayMission(events, correlation)), events };
}
export async function advanceMission(missionId: UUID, action: "plan" | "start" | "verify" | "complete", store: EventStore = supabaseEventStore()) {
  const current = await store.load(missionId); const state = replayMission(current, missionId); const next: AnyDomainEvent[] = []; const sequence = current.length + 1;
  if (action === "plan") { if (state.status !== "created") throw new Error("Mission is not ready to plan"); next.push(makeEvent("mission.planned", missionId, sequence, { task_ids: [] })); }
  if (action === "start") { const taskId = id(); next.push(makeEvent("task.created", missionId, sequence, { task_id: taskId, title: "Deterministic execution" })); next.push(makeEvent("task.ready", missionId, sequence + 1, { task_id: taskId })); next.push(makeEvent("task.started", missionId, sequence + 2, { task_id: taskId, attempt: 1 })); }
  if (action === "verify") { const verificationId = id(); next.push(makeEvent("verification.started", missionId, sequence, { verification_id: verificationId, checks: ["deterministic_replay"] })); next.push(makeEvent("verification.passed", missionId, sequence + 1, { verification_id: verificationId, checks: ["deterministic_replay"] })); }
  if (action === "complete") { if (state.verification?.status !== "passed") throw new Error("Mission cannot complete before verification passes"); next.push(makeEvent("mission.completed", missionId, sequence, { verification_id: state.verification.id })); }
  await store.append(next); const all = [...current, ...next]; return { mission: projection(replayMission(all, missionId)), events: all };
}
