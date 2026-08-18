export type TruthState = "LIVE" | "SIMULATED" | "FIXTURE" | "UNAVAILABLE" | "UNKNOWN" | "DEGRADED";
export type MissionStatus = "DRAFT" | "PLANNING" | "QUEUED" | "RUNNING" | "WAITING_APPROVAL" | "VERIFYING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface MissionProjection {
  id: string;
  name: string;
  goal: string;
  status: MissionStatus;
  truth: TruthState;
  sequence: number;
  taskIds: string[];
  agentIds: string[];
  verificationId?: string;
  failureReason?: string;
}

export interface ApiError { error: { code: string; message: string; requestId: string } }
export interface MissionResponse { mission: MissionProjection; events: unknown[]; requestId: string }

export const transitionable: Record<MissionStatus, readonly MissionStatus[]> = {
  DRAFT: ["PLANNING", "CANCELLED"], PLANNING: ["QUEUED", "FAILED", "CANCELLED"],
  QUEUED: ["RUNNING", "CANCELLED", "FAILED"], RUNNING: ["WAITING_APPROVAL", "VERIFYING", "FAILED", "CANCELLED"],
  WAITING_APPROVAL: ["RUNNING", "FAILED", "CANCELLED"], VERIFYING: ["COMPLETED", "FAILED"],
  COMPLETED: [], FAILED: [], CANCELLED: [],
};

export function assertTransition(from: MissionStatus, to: MissionStatus) {
  if (!transitionable[from].includes(to)) throw new Error(`Invalid mission transition: ${from} -> ${to}`);
}
