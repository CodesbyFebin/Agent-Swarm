import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { replayMission } from "@/src/mission-replay";
import { supabaseEventStore } from "@/src/event-store";
import type { UUID } from "@/src/domain-events";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const missionId = id as UUID;
    const events = await supabaseEventStore().load(missionId);
    return NextResponse.json({ mission: replayMission(events, missionId), events, requestId: randomUUID() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: { code: "READ_FAILED", message: error instanceof Error ? error.message : "Unable to load mission", requestId: randomUUID() } }, { status: 500 });
  }
}
