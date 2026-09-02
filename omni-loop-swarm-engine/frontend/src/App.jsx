import React, { useCallback, useEffect, useState } from "react";
import SwarmHeader from "./components/swarm/SwarmHeader.jsx";
import ProgressBar from "./components/swarm/ProgressBar.jsx";
import SwarmSettings from "./components/swarm/SwarmSettings.jsx";
import InputSection from "./components/swarm/InputSection.jsx";
import ExecuteButton from "./components/swarm/ExecuteButton.jsx";
import AgentGrid from "./components/swarm/AgentGrid.jsx";
import AgentFlowDiagram from "./components/swarm/AgentFlowDiagram.jsx";
import LiveArbiterReasoning from "./components/swarm/LiveArbiterReasoning.jsx";
import CandidateGrid from "./components/swarm/CandidateGrid.jsx";
import IdleState from "./components/swarm/IdleState.jsx";
import SwarmHistoryPanel from "./components/swarm/SwarmHistoryPanel.jsx";
import { useSwarmSettings } from "./hooks/useSwarmSettings.js";
import { useSwarmHistory } from "./hooks/useSwarmHistory.js";
import { useSwarmRun } from "./hooks/useSwarmRun.js";

const PHASE_LABELS = {
  idle: "Ready",
  submitting: "Submitting…",
  running: "Running…",
  complete: "Complete",
  error: "Error",
};

export default function App() {
  const [settings, updateSettings, resetSettings] = useSwarmSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [task, setTask] = useState("");
  const [constraints, setConstraints] = useState("");
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);

  const { phase, events, result, error, progress, liveArbiterText, run, reset, isRunning } = useSwarmRun();
  const {
    history,
    add: addHistory,
    clear: clearHistory,
    remove: removeHistory,
    importEntries,
  } = useSwarmHistory();

  // Sync `mode` switch: changing mode wipes in-flight run.
  const handleModeChange = useCallback((newMode) => {
    updateSettings({ mode: newMode });
    if (phase !== "idle") reset();
  }, [phase, reset, updateSettings]);

  // History → restore.
  const restoreFromHistory = useCallback((entry) => {
    setTask(entry.task);
    setSelectedHistoryEntry(entry);
    setConstraints("");
  }, []);

  // On completion, push to history.
  useEffect(() => {
    if (phase !== "complete" || !result) return;
    addHistory({
      task,
      mode: result.mode || settings.mode,
      agentCount: result.candidates?.length || settings.agentCount,
      roundRobin: result.round_robin?.enabled ?? settings.roundRobin,
      winnerId: result.winner_id,
      finalOutput: result.final_output,
      arbiterConfidence: result.arbiter?.confidence,
      tokens: result.tokens,
      duration: result.total_elapsed_seconds,
    });
  }, [phase, result, task, settings.mode, settings.agentCount, settings.roundRobin, addHistory]);

  const phaseLabel = (() => {
    if (phase === "running" && events.length) {
      const last = events[events.length - 1];
      return last.name;
    }
    if (phase === "submitting") return "Submitting…";
    return PHASE_LABELS[phase] || phase;
  })();

  const handleSubmit = useCallback(() => {
    if (!task.trim()) return;
    const params = {
      task,
      constraints: settings.mode === "single" ? "" : constraints,
      // Blank apiKey/model/baseUrl are valid -- the backend falls back to
      // its Kilo Gateway free tier (anonymous, multi-model pool) rather
      // than rejecting the request.
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.defaultModel,
      mode: settings.mode,
      agentCount: settings.mode === "single" ? 1 : settings.agentCount,
      iterations: settings.maxIterations,
      roundRobin: settings.roundRobin,
      demo: settings.demoMode,
    };
    run(params);
  }, [task, constraints, settings, run]);

  const handleCancel = useCallback(() => reset(), [reset]);

  const showConstraints = settings.mode !== "single";
  // Bring-your-own-key fields are only relevant for a live run; demo mode
  // doesn't touch the network at all.
  const showLiveSettings = !settings.demoMode;

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to main content</a>
      <SwarmHeader
        mode={settings.mode}
        onModeChange={handleModeChange}
        agentCount={settings.agentCount}
        defaultModel={settings.defaultModel}
        phaseLabel={phaseLabel}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        settingsOpen={settingsOpen}
        onReset={() => { reset(); setTask(""); setConstraints(""); }}
        phase={phase}
      />
      <ProgressBar visible={isRunning || phase === "complete"} progress={progress} />

      <main id="main" className="app-main">
        <SwarmSettings
          open={settingsOpen}
          settings={settings}
          onChange={updateSettings}
          onReset={resetSettings}
          showApiFields={showLiveSettings}
        />

        <InputSection
          task={task}
          constraints={constraints}
          onTaskChange={setTask}
          onConstraintsChange={setConstraints}
          showConstraints={showConstraints}
          agentCount={settings.agentCount}
          maxIterations={settings.maxIterations}
          roundRobin={settings.roundRobin}
        />

        <ExecuteButton
          idle={!isRunning}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          disabled={!task.trim()}
          label={`⚡ Execute ${settings.mode === "single" ? "Agent" : `Swarm (${settings.mode === "single" ? 1 : settings.agentCount})`}`}
          cancelLabel="✕ Cancel & Reset"
        />

        {error && (
          <div
            role="alert"
            style={{
              padding: 14, marginBottom: 16, borderRadius: 8,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5", fontSize: 13, whiteSpace: "pre-wrap",
            }}
          >
            ❌ {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <SwarmHistoryPanel
            history={history}
            onRestore={restoreFromHistory}
            onRemove={removeHistory}
            onClear={clearHistory}
            onImport={importEntries}
          />
        </div>

        {(isRunning || (result && phase === "complete")) && (
          <AgentFlowDiagram
            events={events}
            mode={settings.mode}
            roundRobin={settings.roundRobin}
            complete={phase === "complete"}
            demoResult={settings.demoMode ? result : null}
          />
        )}

        {isRunning && !result && (
          <AgentGrid
            mode={settings.mode}
            agentCount={settings.agentCount}
            steps={events}
          />
        )}

        {isRunning && !result && (
          <LiveArbiterReasoning text={liveArbiterText} />
        )}

        {result && (
          <CandidateGrid result={result} mode={settings.mode} />
        )}

        {!result && !isRunning && phase !== "error" && (
          <IdleState mode={settings.mode} />
        )}
      </main>
    </div>
  );
}
