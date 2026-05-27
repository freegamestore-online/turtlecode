import type { TurtleState, TurtleStep, LineSegment } from "../types";

const MAX_STEPS = 10_000;

/** Named CSS colors the kids can use. */
const NAMED_COLORS: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#a855f7",
  pink: "#ec4899",
  black: "#000000",
  white: "#ffffff",
  cyan: "#06b6d4",
  lime: "#84cc16",
  brown: "#92400e",
  gray: "#6b7280",
  grey: "#6b7280",
  gold: "#ca8a04",
  navy: "#1e3a5f",
  teal: "#14b8a6",
  coral: "#f97171",
  skyblue: "#0ea5e9",
  violet: "#8b5cf6",
};

function resolveColor(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (NAMED_COLORS[trimmed.toLowerCase()]) {
    return NAMED_COLORS[trimmed.toLowerCase()]!;
  }
  // Accept hex colors
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function cloneState(s: TurtleState): TurtleState {
  return {
    x: s.x,
    y: s.y,
    angle: s.angle,
    penDown: s.penDown,
    penColor: s.penColor,
    penSize: s.penSize,
    trail: [...s.trail],
  };
}

// ── Token types ──────────────────────────────────────────────

interface Token {
  type:
    | "command"
    | "number"
    | "string"
    | "lparen"
    | "rparen"
    | "lbrace"
    | "rbrace"
    | "semicolon"
    | "comment"
    | "newline";
  value: string;
  line: number;
}

// ── Tokenizer ────────────────────────────────────────────────

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let i = 0;

  while (i < code.length) {
    const ch = code[i]!;

    // Newline
    if (ch === "\n") {
      tokens.push({ type: "newline", value: "\n", line });
      line++;
      i++;
      continue;
    }

    // Whitespace (not newline)
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Comment
    if (ch === "/" && code[i + 1] === "/") {
      let end = i;
      while (end < code.length && code[end] !== "\n") end++;
      tokens.push({ type: "comment", value: code.slice(i, end), line });
      i = end;
      continue;
    }

    // String
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = i + 1;
      while (end < code.length && code[end] !== quote) end++;
      const strVal = code.slice(i + 1, end);
      tokens.push({ type: "string", value: strVal, line });
      i = end + 1;
      continue;
    }

    // Number
    if (/[0-9]/.test(ch)) {
      let end = i;
      while (end < code.length && /[0-9.]/.test(code[end]!)) end++;
      tokens.push({ type: "number", value: code.slice(i, end), line });
      i = end;
      continue;
    }

    // Identifiers / commands
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i;
      while (end < code.length && /[a-zA-Z0-9_]/.test(code[end]!)) end++;
      tokens.push({ type: "command", value: code.slice(i, end), line });
      i = end;
      continue;
    }

    // Single-char tokens
    if (ch === "(") {
      tokens.push({ type: "lparen", value: "(", line });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ")", line });
      i++;
      continue;
    }
    if (ch === "{") {
      tokens.push({ type: "lbrace", value: "{", line });
      i++;
      continue;
    }
    if (ch === "}") {
      tokens.push({ type: "rbrace", value: "}", line });
      i++;
      continue;
    }
    if (ch === ";") {
      tokens.push({ type: "semicolon", value: ";", line });
      i++;
      continue;
    }

    // Skip unknown chars
    i++;
  }

  return tokens;
}

// ── AST ──────────────────────────────────────────────────────

type ASTNode =
  | { type: "forward"; value: number; line: number }
  | { type: "back"; value: number; line: number }
  | { type: "right"; value: number; line: number }
  | { type: "left"; value: number; line: number }
  | { type: "penUp"; line: number }
  | { type: "penDown"; line: number }
  | { type: "penColor"; color: string; line: number }
  | { type: "penSize"; size: number; line: number }
  | { type: "repeat"; count: number; body: ASTNode[]; line: number };

// ── Parser ───────────────────────────────────────────────────

function parse(tokens: Token[]): ASTNode[] {
  // Filter out comments and newlines
  const meaningful = tokens.filter(
    (t) => t.type !== "comment" && t.type !== "newline",
  );
  let pos = 0;

  function peek(): Token | undefined {
    return meaningful[pos];
  }

  function advance(): Token {
    const t = meaningful[pos];
    if (!t) throw new ParseError("Unexpected end of program", peekLine());
    pos++;
    return t;
  }

  function peekLine(): number {
    return meaningful[pos]?.line ?? 0;
  }

  function expect(type: Token["type"], context: string): Token {
    const t = advance();
    if (t.type !== type) {
      throw new ParseError(
        `Expected ${type} ${context}, got "${t.value}"`,
        t.line,
      );
    }
    return t;
  }

  function parseNumber(context: string): number {
    const t = advance();
    if (t.type !== "number") {
      throw new ParseError(`Expected a number for ${context}, got "${t.value}"`, t.line);
    }
    const n = Number(t.value);
    if (isNaN(n)) {
      throw new ParseError(`Invalid number "${t.value}"`, t.line);
    }
    return n;
  }

  function parseString(context: string): string {
    const t = advance();
    if (t.type !== "string") {
      throw new ParseError(`Expected a string for ${context}, got "${t.value}"`, t.line);
    }
    return t.value;
  }

  function parseBlock(): ASTNode[] {
    expect("lbrace", "to start block");
    const body: ASTNode[] = [];
    while (peek() && peek()!.type !== "rbrace") {
      body.push(parseStatement());
    }
    expect("rbrace", "to end block");
    return body;
  }

  function parseStatement(): ASTNode {
    // Skip semicolons
    while (peek()?.type === "semicolon") advance();

    const t = peek();
    if (!t) throw new ParseError("Unexpected end of program", 0);

    if (t.type !== "command") {
      throw new ParseError(`Unexpected "${t.value}"`, t.line);
    }

    const line = t.line;

    switch (t.value) {
      case "forward":
      case "fd": {
        advance();
        expect("lparen", `after ${t.value}`);
        const n = parseNumber(t.value);
        expect("rparen", `after ${t.value} argument`);
        skipSemicolon();
        return { type: "forward", value: n, line };
      }
      case "back":
      case "bk": {
        advance();
        expect("lparen", `after ${t.value}`);
        const n = parseNumber(t.value);
        expect("rparen", `after ${t.value} argument`);
        skipSemicolon();
        return { type: "back", value: n, line };
      }
      case "right":
      case "rt": {
        advance();
        expect("lparen", `after ${t.value}`);
        const n = parseNumber(t.value);
        expect("rparen", `after ${t.value} argument`);
        skipSemicolon();
        return { type: "right", value: n, line };
      }
      case "left":
      case "lt": {
        advance();
        expect("lparen", `after ${t.value}`);
        const n = parseNumber(t.value);
        expect("rparen", `after ${t.value} argument`);
        skipSemicolon();
        return { type: "left", value: n, line };
      }
      case "penUp":
      case "pu": {
        advance();
        expect("lparen", `after ${t.value}`);
        expect("rparen", `after ${t.value}`);
        skipSemicolon();
        return { type: "penUp", line };
      }
      case "penDown":
      case "pd": {
        advance();
        expect("lparen", `after ${t.value}`);
        expect("rparen", `after ${t.value}`);
        skipSemicolon();
        return { type: "penDown", line };
      }
      case "penColor":
      case "color": {
        advance();
        expect("lparen", `after ${t.value}`);
        const c = parseString(t.value);
        expect("rparen", `after ${t.value} argument`);
        skipSemicolon();
        return { type: "penColor", color: c, line };
      }
      case "penSize": {
        advance();
        expect("lparen", `after penSize`);
        const n = parseNumber("penSize");
        expect("rparen", `after penSize argument`);
        skipSemicolon();
        return { type: "penSize", size: n, line };
      }
      case "repeat": {
        advance();
        expect("lparen", "after repeat");
        const count = parseNumber("repeat");
        expect("rparen", "after repeat count");
        const body = parseBlock();
        return { type: "repeat", count, body, line };
      }
      default:
        throw new ParseError(`Unknown command "${t.value}"`, t.line);
    }
  }

  function skipSemicolon() {
    if (peek()?.type === "semicolon") advance();
  }

  const nodes: ASTNode[] = [];
  while (pos < meaningful.length) {
    // Skip trailing semicolons
    if (peek()?.type === "semicolon") {
      advance();
      continue;
    }
    nodes.push(parseStatement());
  }

  return nodes;
}

// ── Execution ────────────────────────────────────────────────

class ParseError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
    this.name = "ParseError";
  }
}

function executeAST(
  nodes: ASTNode[],
  state: TurtleState,
  steps: TurtleStep[],
): void {
  for (const node of nodes) {
    if (steps.length >= MAX_STEPS) {
      throw new ParseError(
        "Program too long (over 10,000 steps). Add fewer repeats or shorter loops.",
        node.line,
      );
    }

    switch (node.type) {
      case "forward": {
        const rad = degToRad(state.angle - 90); // -90 because 0 = up in our system
        const dx = Math.cos(rad) * node.value;
        const dy = Math.sin(rad) * node.value;
        const newX = state.x + dx;
        const newY = state.y + dy;

        if (state.penDown) {
          const seg: LineSegment = {
            x1: state.x,
            y1: state.y,
            x2: newX,
            y2: newY,
            color: state.penColor,
            width: state.penSize,
          };
          state.trail = [...state.trail, seg];
        }

        state.x = newX;
        state.y = newY;
        steps.push({ state: cloneState(state), lineNumber: node.line });
        break;
      }
      case "back": {
        const rad = degToRad(state.angle - 90);
        const dx = -Math.cos(rad) * node.value;
        const dy = -Math.sin(rad) * node.value;
        const newX = state.x + dx;
        const newY = state.y + dy;

        if (state.penDown) {
          const seg: LineSegment = {
            x1: state.x,
            y1: state.y,
            x2: newX,
            y2: newY,
            color: state.penColor,
            width: state.penSize,
          };
          state.trail = [...state.trail, seg];
        }

        state.x = newX;
        state.y = newY;
        steps.push({ state: cloneState(state), lineNumber: node.line });
        break;
      }
      case "right": {
        state.angle = (state.angle + node.value) % 360;
        steps.push({ state: cloneState(state), lineNumber: node.line });
        break;
      }
      case "left": {
        state.angle = ((state.angle - node.value) % 360 + 360) % 360;
        steps.push({ state: cloneState(state), lineNumber: node.line });
        break;
      }
      case "penUp": {
        state.penDown = false;
        steps.push({ state: cloneState(state), lineNumber: node.line });
        break;
      }
      case "penDown": {
        state.penDown = true;
        steps.push({ state: cloneState(state), lineNumber: node.line });
        break;
      }
      case "penColor": {
        state.penColor = resolveColor(node.color);
        steps.push({ state: cloneState(state), lineNumber: node.line });
        break;
      }
      case "penSize": {
        state.penSize = Math.max(1, Math.min(20, node.size));
        steps.push({ state: cloneState(state), lineNumber: node.line });
        break;
      }
      case "repeat": {
        for (let i = 0; i < node.count; i++) {
          executeAST(node.body, state, steps);
        }
        break;
      }
    }
  }
}

// ── Public API ───────────────────────────────────────────────

export interface ExecutionResult {
  steps: TurtleStep[];
  error: string | null;
}

function initialState(): TurtleState {
  return {
    x: 0,
    y: 0,
    angle: 0, // facing up
    penDown: true,
    penColor: "#0ea5e9",
    penSize: 2,
    trail: [],
  };
}

export function execute(code: string): ExecutionResult {
  const state = initialState();
  const steps: TurtleStep[] = [{ state: cloneState(state), lineNumber: 0 }];

  try {
    const tokens = tokenize(code);
    const ast = parse(tokens);
    executeAST(ast, state, steps);
    return { steps, error: null };
  } catch (e) {
    if (e instanceof ParseError) {
      return {
        steps,
        error: `Line ${e.line}: ${e.message}`,
      };
    }
    return {
      steps,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
