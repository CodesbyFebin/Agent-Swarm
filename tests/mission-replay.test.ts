import { describe, expect, it } from "vitest";
import { AnyDomainEvent, UUID } from "../src/domain-events.js";
import { replayMission } from "../src/mission-replay.js";

const mission = "11111111-1111-4111-8111-111111111111" as UUID;
const actor = "22222222-2222-4222-8222-222222222222" as UUID;
const task = "33333333-3333-4333-8333-333333333333" as UUID;
const verification = "44444444-4444-4444-8444-444444444444" as UUID;
const at = "2026-08-18T00:00:00.000Z" as AnyDomainEvent["occurred_at"];
function event<T extends AnyDomainEvent["event_type"]>(sequence_number: number, event_type: T, payload: Extract<AnyDomainEvent, { event_type: T }>["payload"]): Extract<AnyDomainEvent, { event_type: T }> { return { event_id: `${sequence_number}1111111-1111-4111-8111-111111111111` as UUID, event_type, occurred_at: at, actor_type: "system", actor_id: actor, payload, causation_id: null, correlation_id: mission, sequence_number, schema_version: 1 } as Extract<AnyDomainEvent, { event_type: T }>; }

describe("mission event sourcing", () => {
  it("replays the canonical lifecycle and gates completion on verification", () => {
    const state = replayMission([
      event(1, "mission.created", { name: "Dashboard", goal: "Build it" }),
      event(2, "task.created", { task_id: task, title: "Implement UI" }),
      event(3, "task.ready", { task_id: task }),
      event(4, "task.started", { task_id: task, attempt: 1 }),
      event(5, "task.completed", { task_id: task, result: "done" }),
      event(6, "verification.started", { verification_id: verification, checks: ["build", "tests"] }),
      event(7, "verification.passed", { verification_id: verification, checks: ["build", "tests"] }),
      event(8, "mission.completed", { verification_id: verification }),
    ]);
    expect(state.status).toBe("completed"); expect(state.progress).toBe(100); expect(state.verification?.status).toBe("passed");
  });
  it("rejects gaps, mismatched correlation, and premature completion", () => {
    expect(() => replayMission([event(1, "mission.created", { name: "x", goal: "y" }), event(3, "mission.planned", { task_ids: [] })])).toThrow("Expected sequence 2");
    expect(() => replayMission([event(1, "mission.created", { name: "x", goal: "y" }), event(2, "mission.completed", { verification_id: verification })])).toThrow("passed verification");
    const other = { ...event(2, "mission.planned", { task_ids: [] }), correlation_id: "55555555-5555-4555-8555-555555555555" as UUID };
    expect(() => replayMission([event(1, "mission.created", { name: "x", goal: "y" }), other])).toThrow("correlation");
  });
  it("replays approval pauses and resumes", () => {
    const approval = "66666666-6666-4666-8666-666666666666" as UUID;
    const state = replayMission([event(1, "mission.created", { name: "x", goal: "y" }), event(2, "approval.requested", { approval_id: approval, action: "git.push", risk: "high" }), event(3, "approval.granted", { approval_id: approval })]);
    expect(state.status).toBe("running"); expect(state.approvals[approval].status).toBe("granted");
  });
});
