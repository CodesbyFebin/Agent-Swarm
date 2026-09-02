import React from "react";

export default function DecisionBadge({ kind, value }) {
  if (!value) return null;
  const isPositive =
    (kind === "decision" && value === "PASS") ||
    (kind === "approval" && value === "GRANTED");
  const isNegative =
    (kind === "decision" && value === "FAIL") ||
    (kind === "approval" && value === "DENIED");
  const color = isPositive
    ? "var(--green)"
    : isNegative
      ? "var(--red)"
      : "var(--text-3)";
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        background: `${color}22`,
        color,
        letterSpacing: "0.04em",
      }}
    >
      {value}
    </span>
  );
}
