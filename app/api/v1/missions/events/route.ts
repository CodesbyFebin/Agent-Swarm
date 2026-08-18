import { supabaseEventStore } from "@/src/event-store";
import type { UUID } from "@/src/domain-events";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers: { "content-type": "application/json" } });
  const events = await supabaseEventStore().load(id as UUID);
  const encoder = new TextEncoder();
  const body = new ReadableStream({ start(controller) {
    for (const event of events) controller.enqueue(encoder.encode(`id: ${event.sequence_number}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`));
    controller.close();
  }});
  return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
