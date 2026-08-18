export type ISO8601 = string & { readonly __brand: "ISO8601" };
export type UUID = string & { readonly __brand: "UUID" };

export type ActorType = "user" | "agent" | "system";
export type EventType =
  | "mission.created" | "mission.planned" | "mission.cancelled" | "mission.failed" | "mission.completed"
  | "task.created" | "task.ready" | "task.started" | "task.completed" | "task.failed"
  | "agent.started" | "agent.stopped" | "tool.called" | "tool.completed"
  | "approval.requested" | "approval.granted" | "approval.rejected"
  | "verification.started" | "verification.passed" | "verification.failed"
  | "artifact.created";

export interface EventPayloadMap {
  "mission.created": { name: string; goal: string };
  "mission.planned": { task_ids: UUID[] };
  "mission.cancelled": { reason?: string };
  "mission.failed": { reason: string };
  "mission.completed": { verification_id: UUID };
  "task.created": { task_id: UUID; title: string; agent_id?: UUID };
  "task.ready": { task_id: UUID };
  "task.started": { task_id: UUID; attempt: number };
  "task.completed": { task_id: UUID; result?: string };
  "task.failed": { task_id: UUID; reason: string };
  "agent.started": { agent_id: UUID; name: string; role?: string };
  "agent.stopped": { agent_id: UUID; reason?: string };
  "tool.called": { task_id?: UUID; tool: string; sensitivity?: "read" | "write" | "destructive" };
  "tool.completed": { task_id?: UUID; tool: string; success: boolean };
  "approval.requested": { approval_id: UUID; action: string; risk: "low" | "medium" | "high" | "critical" };
  "approval.granted": { approval_id: UUID };
  "approval.rejected": { approval_id: UUID; reason?: string };
  "verification.started": { verification_id: UUID; checks: string[] };
  "verification.passed": { verification_id: UUID; checks: string[] };
  "verification.failed": { verification_id: UUID; reason: string };
  "artifact.created": { artifact_id: UUID; name: string; kind: string; uri?: string };
}

export interface DomainEvent<T extends EventType = EventType> {
  readonly event_id: UUID;
  readonly event_type: T;
  readonly occurred_at: ISO8601;
  readonly actor_type: ActorType;
  readonly actor_id: UUID;
  readonly payload: EventPayloadMap[T];
  readonly causation_id: UUID | null;
  readonly correlation_id: UUID;
  readonly sequence_number: number;
  readonly schema_version: 1;
}

export type AnyDomainEvent = { [T in EventType]: DomainEvent<T> }[EventType];
export type EventStream = readonly AnyDomainEvent[];

export function isUUID(value: string): value is UUID { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function isISO8601(value: string): value is ISO8601 { return !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value); }

export function validateEvent(event: AnyDomainEvent): void {
  if (!isUUID(event.event_id) || !isUUID(event.actor_id) || !isUUID(event.correlation_id) || (event.causation_id !== null && !isUUID(event.causation_id))) throw new Error("Invalid event identifier");
  if (!isISO8601(event.occurred_at)) throw new Error("Invalid event timestamp");
  if (!Number.isInteger(event.sequence_number) || event.sequence_number < 1) throw new Error("Sequence number must be a positive integer");
  if (event.schema_version !== 1) throw new Error("Unsupported event schema version");
}

export function validateStream(events: EventStream, correlationId?: UUID): void {
  events.forEach((event, index) => { validateEvent(event); if (correlationId && event.correlation_id !== correlationId) throw new Error("Event correlation ID mismatch"); if (event.sequence_number !== index + 1) throw new Error(`Expected sequence ${index + 1}, received ${event.sequence_number}`); });
}
