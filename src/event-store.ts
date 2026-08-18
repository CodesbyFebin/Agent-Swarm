import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnyDomainEvent, EventStream, UUID } from "./domain-events.js";

export type EventStore = {
  append(events: EventStream): Promise<void>;
  load(correlationId: UUID): Promise<EventStream>;
};

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function supabaseEventStore(db = client()): EventStore {
  return {
    async append(events) {
      const rows = events.map((event) => ({
        event_id: event.event_id,
        correlation_id: event.correlation_id,
        causation_id: event.causation_id,
        event_type: event.event_type,
        occurred_at: event.occurred_at,
        actor_type: event.actor_type,
        actor_id: event.actor_id,
        payload: event.payload,
        sequence_number: event.sequence_number,
        schema_version: event.schema_version,
      }));
      const { error } = await db.from("domain_events").insert(rows);
      if (error) throw new Error(`Unable to append domain events: ${error.message}`);
    },
    async load(correlationId) {
      const { data, error } = await db.from("domain_events").select("*").eq("correlation_id", correlationId).order("sequence_number", { ascending: true });
      if (error) throw new Error(`Unable to load domain events: ${error.message}`);
      return (data ?? []) as AnyDomainEvent[];
    },
  };
}
