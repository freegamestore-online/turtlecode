export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface TurtleState {
  x: number;
  y: number;
  angle: number; // degrees, 0 = up, clockwise
  penDown: boolean;
  penColor: string;
  penSize: number;
  trail: LineSegment[];
}

export interface TurtleStep {
  state: TurtleState;
  lineNumber: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  hint: string;
  targetDescription: string;
  starThresholds: [number, number, number]; // [3-star, 2-star, 1-star] max command counts
  availableCommands: string[];
  starterCode: string;
}

export const COMMAND_HELP: Record<string, { syntax: string; desc: string }> = {
  forward: { syntax: "forward(n)", desc: "Move forward n pixels" },
  fd: { syntax: "fd(n)", desc: "Move forward n pixels (short)" },
  back: { syntax: "back(n)", desc: "Move backward n pixels" },
  bk: { syntax: "bk(n)", desc: "Move backward n pixels (short)" },
  right: { syntax: "right(n)", desc: "Turn right n degrees" },
  rt: { syntax: "rt(n)", desc: "Turn right n degrees (short)" },
  left: { syntax: "left(n)", desc: "Turn left n degrees" },
  lt: { syntax: "lt(n)", desc: "Turn left n degrees (short)" },
  penUp: { syntax: "penUp()", desc: "Lift the pen (stop drawing)" },
  pu: { syntax: "pu()", desc: "Lift the pen (short)" },
  penDown: { syntax: "penDown()", desc: "Lower the pen (start drawing)" },
  pd: { syntax: "pd()", desc: "Lower the pen (short)" },
  penColor: { syntax: 'penColor("red")', desc: "Set pen color" },
  color: { syntax: 'color("red")', desc: "Set pen color (short)" },
  penSize: { syntax: "penSize(n)", desc: "Set pen line width" },
  repeat: { syntax: "repeat(n) { ... }", desc: "Repeat commands n times" },
};
