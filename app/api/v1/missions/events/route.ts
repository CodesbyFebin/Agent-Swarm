import { supabaseEventStore } from "@/src/event-store";
import type { UUID } from "@/src/domain-events";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: { code: "INVALID_REQUEST", message: "id is required" } }), { status: 400, headers: { "content-type": "application/json" } });
  const cursor = Math.max(Number(url.searchParams.get("after") ?? request.headers.get("last-event-id") ?? 0), 0);
  try {
    const events = (await supabaseEventStore().load(id as UUID)).filter((event) => event.sequence_number > cursor);
    const encoder = new TextEncoder();
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode(`: connected\n\n`));
      for (const event of events) controller.enqueue(encoder.encode(`id: ${event.sequence_number}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`));
      controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      controller.close();
    }});
    return new Response(body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: { code: "READ_FAILED", message: error instanceof Error ? error.message : "Unable to read event stream" } }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
