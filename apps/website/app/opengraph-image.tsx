import { ImageResponse } from "next/og";

export const alt = "AgentSwarm.in — governed AI workforce control plane";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#f5f5fb", background: "radial-gradient(circle at 78% 18%, #5b2312 0%, #0c0c14 38%, #06060a 72%)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28, fontWeight: 700 }}><div style={{ width: 46, height: 46, borderRadius: 14, background: "#ff5a1f", display: "flex", alignItems: "center", justifyContent: "center" }}>A</div>AgentSwarm.in</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}><div style={{ fontSize: 68, lineHeight: 1.05, fontWeight: 800, maxWidth: 980 }}>One goal. A governed swarm. Verified work.</div><div style={{ fontSize: 27, color: "#aaaabd" }}>Open-source mission control for specialist AI agents.</div></div>
      <div style={{ color: "#ff7a3f", fontSize: 22 }}>Plan · Route · Approve · Audit</div>
    </div>, size,
  );
}
