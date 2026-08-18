import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { replayMission } from "@/src/mission-replay";
import { supabaseEventStore } from "@/src/event-store";
import type { ActorType, DomainEvent, UUID } from "@/src/domain-events";

export const runtime = "nodejs";

function uuid(value: string): UUID { return value as UUID; }
function now(): string { return new Date().toISOString(); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; goal?: string };
    if (!body.name?.trim() || !body.goal?.trim()) return NextResponse.json({ error: "name and goal are required" }, { status: 400 });
    const missionId = uuid(randomUUID());
    const event: DomainEvent<"mission.created"> = {
      event_id: uuid(randomUUID()), event_type: "mission.created", occurred_at: now() as DomainEvent["occurred_at"],
      actor_type: "user" satisfies ActorType, actor_id: uuid(randomUUID()), payload: { name: body.name.trim(), goal: body.goal.trim() },
      causation_id: null, correlation_id: missionId, sequence_number: 1, schema_version: 1,
    };
    const store = supabaseEventStore();
    await store.append([event]);
    return NextResponse.json({ mission: replayMission([event]), events: [event] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create mission" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    const events = await supabaseEventStore().load(uuid(id));
    return NextResponse.json({ mission: replayMission(events, uuid(id)), events });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load mission" }, { status: 500 });
  }
}
