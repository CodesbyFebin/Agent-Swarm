import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { replayMission } from "@/src/mission-replay";
import { supabaseEventStore } from "@/src/event-store";
import { advanceMission, createMission } from "@/src/mission-service";
import type { UUID } from "@/src/domain-events";

export const runtime = "nodejs";
const asId = (value: string) => value as UUID;
const requestId = () => randomUUID();
function fail(code: string, message: string, status: number) { return NextResponse.json({ error: { code, message, requestId: requestId() } }, { status }); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: string; name?: string; goal?: string; action?: "plan" | "start" | "verify" | "complete" };
    const store = supabaseEventStore();
    if (body.action && body.id) return NextResponse.json(await advanceMission(asId(body.id), body.action, store));
    if (!body.name?.trim() || !body.goal?.trim()) return fail("INVALID_REQUEST", "name and goal are required", 400);
    const result = await createMission({ name: body.name, goal: body.goal }, store);
    return NextResponse.json({ ...result, requestId: requestId() }, { status: 201 });
  } catch (error) { return fail("COMMAND_REJECTED", error instanceof Error ? error.message : "Unable to process mission command", 409); }
}

export async function GET(request: Request) {
  const url = new URL(request.url); const id = url.searchParams.get("id");
  if (!id) return fail("INVALID_REQUEST", "id is required", 400);
  try { const events = await supabaseEventStore().load(asId(id)); return NextResponse.json({ mission: replayMission(events, asId(id)), events, requestId: requestId() }); }
  catch (error) { return fail("READ_FAILED", error instanceof Error ? error.message : "Unable to load mission", 500); }
}
