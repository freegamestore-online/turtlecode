import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { TurtleStep, TurtleState } from "./types";
import { levels } from "./engine/levels";
import { execute } from "./engine/interpreter";
import TurtleCanvas from "./components/TurtleCanvas";
import CodeEditor from "./components/CodeEditor";
import GameControls from "./components/GameControls";
import LevelSelect from "./components/LevelSelect";
import LevelComplete from "./components/LevelComplete";

function loadCompleted(): Set<number> {
  try {
    const raw = localStorage.getItem("turtlecode_completed");
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function loadStars(): Record<number, number> {
  try {
    const raw = localStorage.getItem("turtlecode_stars");
    if (raw) return JSON.parse(raw) as Record<number, number>;
  } catch {
    /* ignore */
  }
  return {};
}

function saveCompleted(set: Set<number>) {
  localStorage.setItem("turtlecode_completed", JSON.stringify([...set]));
}

function saveStars(map: Record<number, number>) {
  localStorage.setItem("turtlecode_stars", JSON.stringify(map));
}

function computeStars(
  commandCount: number,
  thresholds: [number, number, number],
): number {
  if (commandCount <= thresholds[0]) return 3;
  if (commandCount <= thresholds[1]) return 2;
  return 1;
}

const INITIAL_TURTLE: TurtleState = {
  x: 0,
  y: 0,
  angle: 0,
  penDown: true,
  penColor: "#0ea5e9",
  penSize: 2,
  trail: [],
};

export default function App() {
  const [levelId, setLevelId] = useState(1);
  const [code, setCode] = useState(levels[0]?.starterCode ?? "");
  const [steps, setSteps] = useState<TurtleStep[]>([]);
  const [stepIndex, setStepIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(300);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completedLevels, setCompletedLevels] = useState(loadCompleted);
  const [starRatings, setStarRatings] = useState(loadStars);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const level = useMemo(
    () => levels.find((l) => l.id === levelId) ?? levels[0]!,
    [levelId],
  );

  // Current display state
  const currentStep =
    stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
  const displayTurtle = currentStep ? currentStep.state : INITIAL_TURTLE;
  const activeLine = currentStep ? currentStep.lineNumber : 0;

  // Can we step forward?
  const canStep = steps.length > 0 && stepIndex < steps.length - 1;

  // Count non-trivial steps (exclude the initial state at step 0)
  const commandCount = steps.length > 1 ? steps.length - 1 : 0;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const clearRunning = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    clearRunning();
    setSteps([]);
    setStepIndex(-1);
    setMessage("");
    setIsError(false);
    setIsSuccess(false);
    setShowComplete(false);
  }, [clearRunning]);

  const handleClear = useCallback(() => {
    handleReset();
  }, [handleReset]);

  const handleLevelChange = useCallback(
    (id: number) => {
      clearRunning();
      const newLevel = levels.find((l) => l.id === id);
      setLevelId(id);
      setCode(newLevel?.starterCode ?? "");
      setSteps([]);
      setStepIndex(-1);
      setMessage("");
      setIsError(false);
      setIsSuccess(false);
      setShowComplete(false);
      setShowLevels(false);
    },
    [clearRunning],
  );

  const finishExecution = useCallback(
    (executionSteps: TurtleStep[]) => {
      const lastStep = executionSteps[executionSteps.length - 1];
      if (!lastStep) return;

      const count = executionSteps.length - 1; // exclude initial state
      const stars = computeStars(count, level.starThresholds);

      // Level 15 (freestyle) always passes. Other levels pass when program finishes.
      setMessage(
        `Drawing complete! ${count} command${count !== 1 ? "s" : ""} used.`,
      );
      setIsSuccess(true);
      setIsError(false);

      setCompletedLevels((prev) => {
        const next = new Set(prev);
        next.add(level.id);
        saveCompleted(next);
        return next;
      });
      setStarRatings((prev) => {
        const existing = prev[level.id] ?? 0;
        if (stars > existing) {
          const next = { ...prev, [level.id]: stars };
          saveStars(next);
          return next;
        }
        return prev;
      });

      setTimeout(() => setShowComplete(true), 400);
    },
    [level],
  );

  const handleRun = useCallback(() => {
    handleReset();

    const { steps: execSteps, error } = execute(code);
    setSteps(execSteps);

    if (error && execSteps.length <= 1) {
      // Parse error - show immediately
      setStepIndex(0);
      setMessage(error);
      setIsError(true);
      return;
    }

    if (error) {
      // Runtime error partway through — show steps up to error
      setIsRunning(true);
      let idx = 0;
      setStepIndex(0);

      timerRef.current = setInterval(() => {
        idx++;
        if (idx >= execSteps.length) {
          clearRunning();
          setStepIndex(execSteps.length - 1);
          setMessage(error);
          setIsError(true);
          return;
        }
        setStepIndex(idx);
      }, speed);
      return;
    }

    // Animate through steps
    setIsRunning(true);
    let idx = 0;
    setStepIndex(0);

    timerRef.current = setInterval(() => {
      idx++;
      if (idx >= execSteps.length) {
        clearRunning();
        setStepIndex(execSteps.length - 1);
        finishExecution(execSteps);
        return;
      }
      setStepIndex(idx);
    }, speed);
  }, [code, speed, handleReset, clearRunning, finishExecution]);

  const handleStep = useCallback(() => {
    if (steps.length === 0) {
      // First step: execute and show step 0
      const { steps: execSteps, error } = execute(code);
      setSteps(execSteps);
      setStepIndex(0);
      if (error && execSteps.length <= 1) {
        setMessage(error);
        setIsError(true);
      }
      return;
    }

    if (stepIndex < steps.length - 1) {
      const nextIdx = stepIndex + 1;
      setStepIndex(nextIdx);
      if (nextIdx === steps.length - 1) {
        finishExecution(steps);
      }
    }
  }, [steps, stepIndex, code, finishExecution]);

  // Win modal data
  const winStars =
    steps.length > 1
      ? computeStars(steps.length - 1, level.starThresholds)
      : 0;
  const hasNextLevel = levels.some((l) => l.id === levelId + 1);

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{"🐢"}</span>
          <span>TurtleCode</span>
        </h1>

        <div style={{ flex: 1 }} />

        <a
          href="https://freegamestore.online"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textDecoration: "none",
            marginRight: 8,
          }}
        >
          FreeGameStore
        </a>

        <button
          onClick={() => setShowLevels(true)}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid var(--line-strong)",
            background: "var(--paper)",
            color: "var(--ink)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Levels
        </button>
      </header>

      {/* Level info bar */}
      <div
        style={{
          padding: "6px 16px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>
          Level {level.id}
        </span>
        <span style={{ fontWeight: 600 }}>{level.name}</span>
        <span style={{ color: "var(--muted)" }}>{level.description}</span>
        <span
          style={{
            marginLeft: "auto",
            color: "var(--muted)",
            fontSize: 12,
            fontStyle: "italic",
          }}
        >
          Target: {level.targetDescription}
        </span>
      </div>

      {/* Main split layout */}
      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left: Canvas view (65%) */}
        <div
          style={{
            flex: "0 0 65%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflow: "hidden",
            background: "var(--paper)",
          }}
        >
          <TurtleCanvas turtle={displayTurtle} />
        </div>

        {/* Right: Editor + Controls (35%) */}
        <div
          style={{
            flex: "0 0 35%",
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--line)",
            padding: 12,
            gap: 10,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <GameControls
            onRun={handleRun}
            onStep={handleStep}
            onReset={handleReset}
            onClear={handleClear}
            isRunning={isRunning}
            hasCode={code.trim().length > 0}
            canStep={canStep || steps.length === 0}
            speed={speed}
            onSpeedChange={setSpeed}
            message={message}
            isError={isError}
            isSuccess={isSuccess}
          />

          <CodeEditor
            code={code}
            onChange={setCode}
            activeLine={activeLine}
            availableCommands={level.availableCommands}
            disabled={isRunning}
            hasError={isError}
          />
        </div>
      </div>

      {/* Modals */}
      {showLevels && (
        <LevelSelect
          currentLevel={levelId}
          completedLevels={completedLevels}
          starRatings={starRatings}
          onSelect={handleLevelChange}
          onClose={() => setShowLevels(false)}
        />
      )}

      {showComplete && (
        <LevelComplete
          levelName={level.name}
          stars={winStars}
          commandCount={commandCount}
          hasNextLevel={hasNextLevel}
          onNext={() => handleLevelChange(levelId + 1)}
          onRetry={() => {
            setShowComplete(false);
            handleReset();
          }}
          onLevels={() => {
            setShowComplete(false);
            setShowLevels(true);
          }}
        />
      )}
    </div>
  );
}
