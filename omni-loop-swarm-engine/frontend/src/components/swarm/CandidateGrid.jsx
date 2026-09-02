import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CandidateCard from "./CandidateCard.jsx";
import CandidateComparison from "./CandidateComparison.jsx";
import ArbiterPanel from "./ArbiterPanel.jsx";
import FinalSwarmOutput from "./FinalSwarmOutput.jsx";

export default function CandidateGrid({ result, mode }) {
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("grid"); // "grid" | "compare"
  if (!result) return null;
  const { candidates, arbiter, winner_id, final_output } = result;
  const isSingle = mode === "single";
  const canCompare = candidates.length >= 2;
  const activeWinnerId = arbiter?.winner || winner_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h3
          style={{
            fontSize: 13, fontWeight: 700, color: "var(--text-2)",
            textTransform: "uppercase", letterSpacing: "0.05em",
            display: "flex", alignItems: "center", gap: 8, margin: 0,
          }}
        >
          <span aria-hidden>⬡</span>
          {isSingle ? "Agent Output" : "Candidate Grid"}
          <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>
            • {candidates.length} candidate{candidates.length === 1 ? "" : "s"} generated
          </span>
        </h3>

        {canCompare && (
          <div role="radiogroup" aria-label="Candidate view" style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {[["grid", "⬛ Grid"], ["compare", "⇄ Compare"]].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                onClick={() => setView(id)}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  border: `1px solid ${view === id ? "#8b5cf6" : "var(--border-2)"}`,
                  background: view === id ? "rgba(139,92,246,0.15)" : "transparent",
                  color: view === id ? "#c4b5fd" : "var(--text-3)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "grid" || !canCompare ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(${isSingle ? "100%" : "320px"}, 1fr))`,
            gap: 16,
          }}
        >
          {candidates.map((cand, i) => (
            <CandidateCard
              key={cand.id}
              candidate={cand}
              index={i}
              isWinner={activeWinnerId === cand.id}
              isSelected={selected === cand.id}
              onSelect={setSelected}
              mode={mode}
            />
          ))}
        </div>
      ) : (
        <CandidateComparison candidates={candidates} winnerId={activeWinnerId} />
      )}

      <AnimatePresence>
        {arbiter && <ArbiterPanel arbiter={arbiter} candidates={candidates} />}
      </AnimatePresence>

      <FinalSwarmOutput text={final_output} />
    </motion.div>
  );
}
