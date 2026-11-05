import { describe, it, expect } from "vitest";
import { execute } from "./interpreter";
import { levels } from "./levels";
import { levelTarget, matchesTarget } from "./target";
import type { LineSegment } from "../types";

function trail(code: string): LineSegment[] {
  const { steps, error } = execute(code);
  expect(error).toBeNull();
  return steps[steps.length - 1]!.state.trail;
}

const square = trail("repeat(4) { fd(100); rt(90) }");

describe("matchesTarget", () => {
  it("matches the same drawing", () => {
    expect(matchesTarget(trail("repeat(4) { fd(100); rt(90) }"), square)).toBe(true);
  });

  it("is independent of drawing order and direction", () => {
    // Counter-clockwise from the bottom-right corner
    const ccw = trail("rt(90)\nfd(100)\nlt(90)\nrepeat(4) { fd(100); lt(90) }");
    expect(matchesTarget(ccw, square)).toBe(true);
  });

  it("accepts lines split into shorter pieces", () => {
    expect(matchesTarget(trail("repeat(4) { fd(50); fd(50); rt(90) }"), square)).toBe(true);
  });

  it("tolerates tiny differences", () => {
    expect(matchesTarget(trail("repeat(4) { fd(102); rt(90) }"), square)).toBe(true);
  });

  it("rejects an empty drawing", () => {
    expect(matchesTarget([], square)).toBe(false);
  });

  it("rejects an incomplete drawing", () => {
    expect(matchesTarget(trail("repeat(3) { fd(100); rt(90) }"), square)).toBe(false);
  });

  it("rejects extra lines outside the target", () => {
    expect(matchesTarget(trail("repeat(4) { fd(100); rt(90) }\nrt(45)\nfd(50)"), square)).toBe(false);
  });

  it("rejects a mirrored shape", () => {
    expect(matchesTarget(trail("repeat(4) { fd(100); lt(90) }"), square)).toBe(false);
  });

  it("checks pen colour and size only when matchStyle is set", () => {
    const red = trail('color("red")\nrepeat(4) { fd(100); rt(90) }');
    expect(matchesTarget(red, square)).toBe(true);
    expect(matchesTarget(red, square, true)).toBe(false);
    expect(matchesTarget(square, square, true)).toBe(true);
  });
});

describe("levels", () => {
  for (const level of levels) {
    it(`level ${level.id} (${level.name}): starter code doesn't already pass`, () => {
      // Level 1's starter code is the answer: it's the tutorial.
      if (!level.solution || level.id === 1) return;
      const { steps } = execute(level.starterCode);
      const drawn = steps[steps.length - 1]!.state.trail;
      expect(matchesTarget(drawn, levelTarget(level), level.matchStyle)).toBe(false);
    });

    it(`level ${level.id} (${level.name}): reference solution passes with 3 stars`, () => {
      if (!level.solution) {
        expect(levelTarget(level)).toEqual([]);
        return;
      }
      const result = execute(level.solution, level.availableCommands);
      expect(result.error).toBeNull();
      const drawn = result.steps[result.steps.length - 1]!.state.trail;
      expect(matchesTarget(drawn, levelTarget(level), level.matchStyle)).toBe(true);
      expect(result.statements).toBeLessThanOrEqual(level.starThresholds[0]);
    });
  }

  it("a comment-only program no longer completes level 3", () => {
    const level = levels.find((l) => l.id === 3)!;
    expect(matchesTarget(trail("// just a comment\n"), levelTarget(level))).toBe(false);
  });
});
