import { GameShell, GameTopbar, GameButton } from "@freegamestore/games";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { TurtleStep, TurtleState } from "./types";
import { levels } from "./engine/levels";
import { execute } from "./engine/interpreter";
import { levelTarget, matchesTarget } from "./engine/target";
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

function loadSavedCode(): Record<number, string> {
  try {
    const raw = localStorage.getItem("turtlecode_code");
    if (raw) return JSON.parse(raw) as Record<number, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function loadCode(levelId: number): string {
  return (
    loadSavedCode()[levelId] ??
    levels.find((l) => l.id === levelId)?.starterCode ??
    ""
  );
}

function saveCode(levelId: number, code: string) {
  try {
    localStorage.setItem(
      "turtlecode_code",
      JSON.stringify({ ...loadSavedCode(), [levelId]: code }),
    );
    localStorage.setItem("turtlecode_level", String(levelId));
  } catch {
    /* ignore */
  }
}

function loadLevel(): number {
  try {
    const id = Number(localStorage.getItem("turtlecode_level"));
    if (levels.some((l) => l.id === id)) return id;
  } catch {
    /* ignore */
  }
  return 1;
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

function GameContent() {
  const [levelId, setLevelId] = useState(loadLevel);
  const [code, setCode] = useState(() => loadCode(levelId));
  const [steps, setSteps] = useState<TurtleStep[]>([]);
  const [statementCount, setStatementCount] = useState(0);
  const [stepIndex, setStepIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(300);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [completedLevels, setCompletedLevels] = useState(loadCompleted);
  const [starRatings, setStarRatings] = useState(loadStars);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read by the running animation so speed changes apply mid-run
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const level = useMemo(
    () => levels.find((l) => l.id === levelId) ?? levels[0]!,
    [levelId],
  );
  const target = useMemo(() => levelTarget(level), [level]);

  useEffect(() => {
    saveCode(levelId, code);
  }, [levelId, code]);

  // Current display state
  const currentStep =
    stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
  const displayTurtle = currentStep ? currentStep.state : INITIAL_TURTLE;
  const activeLine = currentStep ? currentStep.lineNumber : 0;

  // Can we step forward?
  const canStep = steps.length > 0 && stepIndex < steps.length - 1;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  const clearRunning = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // A pending success modal belongs to the run being cleared
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
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

  const handleLevelChange = useCallback(
    (id: number) => {
      handleReset();
      setLevelId(id);
      setCode(loadCode(id));
      setShowLevels(false);
      setShowHint(false);
    },
    [handleReset],
  );

  const finishExecution = useCallback(
    (executionSteps: TurtleStep[], count: number) => {
      const lastStep = executionSteps[executionSteps.length - 1];
      if (!lastStep) return;

      const { trail } = lastStep.state;
      // Freestyle (no solution) passes with any drawing.
      const passed = level.solution
        ? matchesTarget(trail, target, level.matchStyle)
        : trail.length > 0;
      if (!passed) {
        setMessage(
          trail.length === 0
            ? "Nothing drawn yet. Trace the faint target shape!"
            : "Not quite. Your drawing doesn't match the faint target shape.",
        );
        setShowHint(true);
        return;
      }

      const stars = computeStars(count, level.starThresholds);
      setMessage(
        `Drawing complete! ${count} command${count !== 1 ? "s" : ""} used.`,
      );
      setIsSuccess(true);
      setIsError(false);

      const completed = new Set(completedLevels).add(level.id);
      saveCompleted(completed);
      setCompletedLevels(completed);
      if (stars > (starRatings[level.id] ?? 0)) {
        const ratings = { ...starRatings, [level.id]: stars };
        saveStars(ratings);
        setStarRatings(ratings);
      }

      completeTimerRef.current = setTimeout(() => setShowComplete(true), 400);
    },
    [level, target, completedLevels, starRatings],
  );

  const handleRun = useCallback(() => {
    handleReset();

    const { steps: execSteps, error, statements } = execute(
      code,
      level.availableCommands,
    );
    setSteps(execSteps);
    setStatementCount(statements);

    if (error && execSteps.length <= 1) {
      // Parse error - show immediately
      setStepIndex(0);
      setMessage(error);
      setIsError(true);
      return;
    }

    // Animate through steps; a runtime error is shown once the steps up to it have played
    setIsRunning(true);
    let idx = 0;
    setStepIndex(0);

    const tick = () => {
      idx++;
      if (idx >= execSteps.length) {
        clearRunning();
        setStepIndex(execSteps.length - 1);
        if (error) {
          setMessage(error);
          setIsError(true);
        } else {
          finishExecution(execSteps, statements);
        }
        return;
      }
      setStepIndex(idx);
      timerRef.current = setTimeout(tick, speedRef.current);
    };
    timerRef.current = setTimeout(tick, speedRef.current);
  }, [code, level, handleReset, clearRunning, finishExecution]);

  const handleStep = useCallback(() => {
    if (steps.length === 0) {
      // First step: execute and show step 0
      const { steps: execSteps, error, statements } = execute(
        code,
        level.availableCommands,
      );
      setSteps(execSteps);
      setStatementCount(statements);
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
        finishExecution(steps, statementCount);
      }
    }
  }, [steps, stepIndex, statementCount, code, level, finishExecution]);

  // Win modal data
  const winStars = computeStars(statementCount, level.starThresholds);
  const hasNextLevel = levels.some((l) => l.id === levelId + 1);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0">
        <GameTopbar
          title="TurtleCode"
          actions={<GameButton size="sm" variant="ghost" onClick={() => setShowLevels(true)}>Levels</GameButton>}
          rules={
            <div>
              <h3 style={{ marginBottom: "0.5rem", fontWeight: 700 }}>TurtleCode</h3>
              <p>Write code to steer the turtle and trace the faint target shape on the canvas.</p>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>How to play</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Type commands or tap them in the Commands list</li>
                <li>Run to watch the whole program, or Step through it</li>
                <li>The turtle starts in the centre, facing up</li>
              </ul>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>Rules</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Your drawing must match the target: every line, nothing extra</li>
                <li>Only the level's listed commands can be used</li>
                <li>Fewer lines of code earn more stars, so use repeat</li>
              </ul>
            </div>
          }
        />
      </div>

      {/* Level info bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--line)] px-4 py-1.5 text-[13px]">
        <span className="font-bold text-[var(--accent)]">Level {level.id}</span>
        <span className="font-semibold">{level.name}</span>
        <span className="text-[var(--muted)]">{level.description}</span>
        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          className="ml-auto cursor-pointer rounded-md border border-[var(--line-strong)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink)]"
        >
          {showHint ? "Hide hint" : "Hint"}
        </button>
        <span className="basis-full text-xs italic text-[var(--muted)]">
          Target: {level.targetDescription}
        </span>
        {showHint && (
          <span className="basis-full text-xs text-[var(--ink)]">
            {"💡 "}{level.hint}
          </span>
        )}
      </div>

      {/* Main layout: stacked on phones, side by side on wide screens */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden landscape:flex-row md:flex-row">
        {/* Canvas view */}
        <div className="flex h-[34%] shrink-0 items-center justify-center overflow-hidden bg-[var(--paper)] p-2 landscape:h-auto landscape:w-1/2 md:h-auto md:w-[65%] md:p-4 md:landscape:w-[65%]">
          <TurtleCanvas turtle={displayTurtle} target={target} />
        </div>

        {/* Editor + Controls */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto border-t border-[var(--line)] p-3 landscape:border-t-0 landscape:border-l md:border-t-0 md:border-l">
          <GameControls
            onRun={handleRun}
            onStep={handleStep}
            onReset={handleReset}
            onClear={handleReset}
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
          commandCount={statementCount}
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

export default function App() {
  return <GameShell><GameContent /></GameShell>;
}
