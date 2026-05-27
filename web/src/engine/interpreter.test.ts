import { describe, it, expect } from "vitest";
import { execute } from "./interpreter";
import type { LineSegment, TurtleState } from "../types";

// ── Helpers ─────────────────────────────────────────────────

/** Return the final TurtleState from an execution result (last step). */
function finalState(code: string): TurtleState {
  const result = execute(code);
  expect(result.error).toBeNull();
  return result.steps[result.steps.length - 1]!.state;
}

/** Return all line segments produced by the code. */
function segments(code: string): LineSegment[] {
  return finalState(code).trail;
}

/** Close-enough floating point comparison. */
function near(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) < eps;
}

// ── Tests ───────────────────────────────────────────────────

describe("TurtleCode interpreter", () => {
  // ── Initial state ───────────────────────────────────────────

  describe("initial state", () => {
    it("starts at origin facing up with pen down", () => {
      const result = execute("");
      expect(result.error).toBeNull();
      // step 0 is the initial snapshot
      const s = result.steps[0]!.state;
      expect(s.x).toBe(0);
      expect(s.y).toBe(0);
      expect(s.angle).toBe(0);
      expect(s.penDown).toBe(true);
      expect(s.penColor).toBe("#0ea5e9");
      expect(s.penSize).toBe(2);
      expect(s.trail).toEqual([]);
    });
  });

  // ── forward / fd ────────────────────────────────────────────

  describe("forward / fd", () => {
    it("forward(100) moves up when angle is 0", () => {
      const s = finalState("forward(100)");
      expect(near(s.x, 0)).toBe(true);
      expect(near(s.y, -100)).toBe(true); // up = negative y in canvas coords
    });

    it("fd alias works identically to forward", () => {
      const s = finalState("fd(50)");
      expect(near(s.x, 0)).toBe(true);
      expect(near(s.y, -50)).toBe(true);
    });

    it("forward after right(90) moves to the right", () => {
      const s = finalState("right(90)\nforward(100)");
      expect(near(s.x, 100)).toBe(true);
      expect(near(s.y, 0)).toBe(true);
    });

    it("forward after right(180) moves down", () => {
      const s = finalState("right(180)\nforward(100)");
      expect(near(s.x, 0)).toBe(true);
      expect(near(s.y, 100)).toBe(true);
    });

    it("forward after right(270) moves left", () => {
      const s = finalState("right(270)\nforward(100)");
      expect(near(s.x, -100)).toBe(true);
      expect(near(s.y, 0)).toBe(true);
    });

    it("forward draws a line segment when pen is down", () => {
      const segs = segments("forward(100)");
      expect(segs.length).toBe(1);
      expect(segs[0]!.x1).toBe(0);
      expect(segs[0]!.y1).toBe(0);
      expect(near(segs[0]!.x2, 0)).toBe(true);
      expect(near(segs[0]!.y2, -100)).toBe(true);
    });

    it("two forwards produce two segments and cumulative position", () => {
      const s = finalState("forward(50)\nforward(50)");
      expect(near(s.y, -100)).toBe(true);
      expect(s.trail.length).toBe(2);
    });
  });

  // ── back / bk ───────────────────────────────────────────────

  describe("back / bk", () => {
    it("back(100) moves down when angle is 0 (facing up)", () => {
      const s = finalState("back(100)");
      expect(near(s.x, 0)).toBe(true);
      expect(near(s.y, 100)).toBe(true);
    });

    it("bk alias works identically to back", () => {
      const s = finalState("bk(75)");
      expect(near(s.x, 0)).toBe(true);
      expect(near(s.y, 75)).toBe(true);
    });

    it("back draws a line segment when pen is down", () => {
      const segs = segments("back(100)");
      expect(segs.length).toBe(1);
    });

    it("back after right(90) moves to the left", () => {
      const s = finalState("right(90)\nback(100)");
      expect(near(s.x, -100)).toBe(true);
      expect(near(s.y, 0)).toBe(true);
    });
  });

  // ── right / rt ──────────────────────────────────────────────

  describe("right / rt", () => {
    it("right(90) sets angle to 90", () => {
      const s = finalState("right(90)");
      expect(s.angle).toBe(90);
    });

    it("rt alias works identically to right", () => {
      const s = finalState("rt(45)");
      expect(s.angle).toBe(45);
    });

    it("multiple rights accumulate", () => {
      const s = finalState("right(90)\nright(90)");
      expect(s.angle).toBe(180);
    });

    it("right(360) wraps to 0", () => {
      const s = finalState("right(360)");
      expect(s.angle).toBe(0);
    });

    it("right does not draw a line", () => {
      const segs = segments("right(90)");
      expect(segs.length).toBe(0);
    });
  });

  // ── left / lt ───────────────────────────────────────────────

  describe("left / lt", () => {
    it("left(90) sets angle to 270", () => {
      const s = finalState("left(90)");
      expect(s.angle).toBe(270);
    });

    it("lt alias works identically to left", () => {
      const s = finalState("lt(45)");
      expect(s.angle).toBe(315);
    });

    it("left(360) wraps to 0", () => {
      const s = finalState("left(360)");
      expect(s.angle).toBe(0);
    });
  });

  // ── penUp / pu ──────────────────────────────────────────────

  describe("penUp / pu", () => {
    it("penUp stops drawing lines", () => {
      const segs = segments("penUp()\nforward(100)");
      expect(segs.length).toBe(0);
    });

    it("pu alias works identically to penUp", () => {
      const segs = segments("pu()\nforward(100)");
      expect(segs.length).toBe(0);
    });

    it("penUp still moves the turtle position", () => {
      const s = finalState("penUp()\nforward(100)");
      expect(near(s.y, -100)).toBe(true);
    });
  });

  // ── penDown / pd ────────────────────────────────────────────

  describe("penDown / pd", () => {
    it("penDown resumes drawing after penUp", () => {
      const segs = segments("penUp()\nforward(50)\npenDown()\nforward(50)");
      expect(segs.length).toBe(1);
      // Only the second forward should draw
      expect(near(segs[0]!.y1, -50)).toBe(true);
      expect(near(segs[0]!.y2, -100)).toBe(true);
    });

    it("pd alias works identically to penDown", () => {
      const segs = segments("pu()\nfd(50)\npd()\nfd(50)");
      expect(segs.length).toBe(1);
    });
  });

  // ── penColor ────────────────────────────────────────────────

  describe("penColor / color", () => {
    it('penColor("red") changes line color', () => {
      const segs = segments('penColor("red")\nforward(100)');
      expect(segs[0]!.color).toBe("#ef4444");
    });

    it('color alias works the same as penColor', () => {
      const segs = segments('color("blue")\nforward(100)');
      expect(segs[0]!.color).toBe("#3b82f6");
    });

    it("accepts hex color strings", () => {
      const segs = segments('penColor("#ff00ff")\nforward(100)');
      expect(segs[0]!.color).toBe("#ff00ff");
    });

    it("color changes mid-program affect subsequent segments", () => {
      const segs = segments(
        'forward(50)\npenColor("green")\nforward(50)',
      );
      expect(segs.length).toBe(2);
      expect(segs[0]!.color).toBe("#0ea5e9"); // default
      expect(segs[1]!.color).toBe("#22c55e"); // green
    });
  });

  // ── penSize ─────────────────────────────────────────────────

  describe("penSize", () => {
    it("penSize(5) changes line width", () => {
      const segs = segments("penSize(5)\nforward(100)");
      expect(segs[0]!.width).toBe(5);
    });

    it("penSize is clamped to minimum of 1", () => {
      const segs = segments("penSize(0)\nforward(100)");
      expect(segs[0]!.width).toBe(1);
    });

    it("penSize is clamped to maximum of 20", () => {
      const segs = segments("penSize(50)\nforward(100)");
      expect(segs[0]!.width).toBe(20);
    });

    it("penSize changes mid-program affect subsequent segments", () => {
      const segs = segments("forward(50)\npenSize(10)\nforward(50)");
      expect(segs[0]!.width).toBe(2); // default
      expect(segs[1]!.width).toBe(10);
    });
  });

  // ── repeat ──────────────────────────────────────────────────

  describe("repeat", () => {
    it("repeat(3) executes body 3 times", () => {
      const segs = segments("repeat(3) { forward(10) }");
      expect(segs.length).toBe(3);
    });

    it("repeat(1) executes body once", () => {
      const segs = segments("repeat(1) { forward(10) }");
      expect(segs.length).toBe(1);
    });

    it("nested repeat multiplies iterations", () => {
      const segs = segments(
        "repeat(3) { repeat(2) { forward(10) } }",
      );
      expect(segs.length).toBe(6); // 3 * 2
    });

    it("repeat body can contain multiple statements", () => {
      const segs = segments("repeat(2) { forward(10); right(90) }");
      // 2 iterations * 1 forward each = 2 segments (right doesn't draw)
      expect(segs.length).toBe(2);
    });
  });

  // ── Comments ────────────────────────────────────────────────

  describe("comments", () => {
    it("line comments are ignored", () => {
      const s = finalState("// go forward\nforward(100)");
      expect(near(s.y, -100)).toBe(true);
    });

    it("comments after code on the same line do not interfere", () => {
      // The tokenizer treats "//" as a comment start
      const result = execute("forward(100) // move up");
      expect(result.error).toBeNull();
    });

    it("program with only comments produces no steps beyond initial", () => {
      const result = execute("// nothing here\n// still nothing");
      expect(result.error).toBeNull();
      expect(result.steps.length).toBe(1); // only the initial state step
    });
  });

  // ── Parse errors ────────────────────────────────────────────

  describe("parse errors", () => {
    it("unknown command produces an error", () => {
      const result = execute("dance(100)");
      expect(result.error).not.toBeNull();
      expect(result.error).toContain("dance");
    });

    it("missing parenthesis produces an error", () => {
      const result = execute("forward 100");
      expect(result.error).not.toBeNull();
    });

    it("missing argument produces an error", () => {
      const result = execute("forward()");
      expect(result.error).not.toBeNull();
    });

    it("unclosed repeat block produces an error", () => {
      const result = execute("repeat(3) { forward(10)");
      expect(result.error).not.toBeNull();
    });

    it("unexpected closing brace produces an error", () => {
      const result = execute("}");
      expect(result.error).not.toBeNull();
    });
  });

  // ── Step limit protection ───────────────────────────────────

  describe("step limit", () => {
    it("programs exceeding 10,000 steps produce an error", () => {
      // repeat(200) { repeat(200) { forward(1) } } = 40,000 steps
      const result = execute("repeat(200) { repeat(200) { forward(1) } }");
      expect(result.error).not.toBeNull();
      expect(result.error).toContain("10,000");
    });
  });

  // ── Shape tests ─────────────────────────────────────────────

  describe("shapes", () => {
    it("square: repeat(4) { fd(100); rt(90) } produces 4 segments", () => {
      const code = "repeat(4) { fd(100); rt(90) }";
      const segs = segments(code);
      expect(segs.length).toBe(4);

      // Turtle should return to origin (closed shape)
      const s = finalState(code);
      expect(near(s.x, 0)).toBe(true);
      expect(near(s.y, 0)).toBe(true);
      expect(s.angle).toBe(0); // 4 * 90 = 360 -> 0
    });

    it("triangle: repeat(3) { fd(100); rt(120) } produces 3 segments", () => {
      const code = "repeat(3) { fd(100); rt(120) }";
      const segs = segments(code);
      expect(segs.length).toBe(3);

      // Closed shape — returns to origin
      const s = finalState(code);
      expect(near(s.x, 0)).toBe(true);
      expect(near(s.y, 0)).toBe(true);
      expect(s.angle).toBe(0); // 3 * 120 = 360 -> 0
    });

    it("star: repeat(5) { fd(100); rt(144) } produces 5 segments", () => {
      const code = "repeat(5) { fd(100); rt(144) }";
      const segs = segments(code);
      expect(segs.length).toBe(5);

      // Closed star — returns to origin
      const s = finalState(code);
      expect(near(s.x, 0, 0.1)).toBe(true);
      expect(near(s.y, 0, 0.1)).toBe(true);
      expect(s.angle).toBe(0); // 5 * 144 = 720 % 360 = 0
    });

    it("hexagon: repeat(6) { fd(50); rt(60) } produces 6 segments and closes", () => {
      const code = "repeat(6) { fd(50); rt(60) }";
      const segs = segments(code);
      expect(segs.length).toBe(6);

      const s = finalState(code);
      expect(near(s.x, 0, 0.1)).toBe(true);
      expect(near(s.y, 0, 0.1)).toBe(true);
    });
  });

  // ── Semicolons ──────────────────────────────────────────────

  describe("semicolons", () => {
    it("optional semicolons between statements are accepted", () => {
      const s = finalState("fd(50); rt(90); fd(50)");
      expect(near(s.x, 50)).toBe(true);
      expect(near(s.y, -50)).toBe(true);
    });

    it("trailing semicolons are accepted", () => {
      const result = execute("fd(50);");
      expect(result.error).toBeNull();
    });
  });

  // ── Comprehensive movement tests ───────────────────────────

  describe("movement composition", () => {
    it("left then forward moves correctly", () => {
      const s = finalState("left(90)\nforward(100)");
      expect(near(s.x, -100)).toBe(true);
      expect(near(s.y, 0)).toBe(true);
    });

    it("forward + back returns to origin", () => {
      const s = finalState("forward(100)\nback(100)");
      expect(near(s.x, 0)).toBe(true);
      expect(near(s.y, 0)).toBe(true);
    });

    it("right(45) + forward(100) moves diagonally", () => {
      const s = finalState("right(45)\nforward(100)");
      const expected = 100 * Math.cos(Math.PI / 4); // ~70.71
      expect(near(s.x, expected, 0.1)).toBe(true);
      expect(near(s.y, -expected, 0.1)).toBe(true);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────

  describe("edge cases", () => {
    it("empty program produces no error and one initial step", () => {
      const result = execute("");
      expect(result.error).toBeNull();
      expect(result.steps.length).toBe(1);
    });

    it("forward(0) creates a zero-length segment at current position", () => {
      const segs = segments("forward(0)");
      expect(segs.length).toBe(1);
      expect(segs[0]!.x1).toBe(0);
      expect(segs[0]!.y1).toBe(0);
      expect(segs[0]!.x2).toBe(0);
      expect(segs[0]!.y2).toBe(0);
    });

    it("single quotes work for color strings", () => {
      const segs = segments("penColor('red')\nforward(100)");
      expect(segs[0]!.color).toBe("#ef4444");
    });
  });
});
