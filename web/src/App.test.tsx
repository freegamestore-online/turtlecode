import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function mount() {
  act(() => root.render(<App />));
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  );
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

function click(label: string) {
  act(() => button(label).click());
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function typeCode(code: string) {
  const ta = container.querySelector("textarea")!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setValue.call(ta, code);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

// Level 1's starter code (forward(100)) solves it. A run shows each step for
// one tick and finishes on the tick after the last, so 2 steps (start +
// forward) take 2 x 300ms at Normal speed; the success modal follows 400ms later.
describe("success modal timer", () => {
  it("appears after a win", () => {
    mount();
    click("Run");
    advance(600);
    expect(container.textContent).toContain("Drawing complete!");
    advance(400);
    expect(container.textContent).toContain("Drawing Complete!");
    expect(localStorage.getItem("turtlecode_completed")).toBe("[1]");
    expect(localStorage.getItem("turtlecode_stars")).toBe('{"1":3}');
  });

  it("does not appear when Reset is pressed right after a win", () => {
    mount();
    click("Run");
    advance(600);
    click("Reset");
    advance(500);
    expect(container.textContent).not.toContain("Drawing Complete!");
  });

  it("does not appear when the level changes right after a win", () => {
    mount();
    click("Run");
    advance(600);
    click("Levels");
    click("Square");
    advance(500);
    expect(container.textContent).not.toContain("Drawing Complete!");
  });
});

describe("speed", () => {
  it("applies a speed change made during a run", () => {
    mount();
    typeCode("forward(10)\nforward(10)\nforward(10)\nforward(10)");
    click("Run");
    click("Fast"); // first tick is already queued at 300ms, the other 4 go at 100ms
    advance(300 + 4 * 100); // a run stuck at Normal would need 5 x 300ms
    expect(container.textContent).toContain("Not quite");
  });
});

describe("saved code", () => {
  it("restores the level and code after a reload", () => {
    mount();
    typeCode("forward(42)");
    act(() => root.unmount());
    root = createRoot(container);
    mount();
    expect(container.querySelector("textarea")!.value).toBe("forward(42)");
  });
});
