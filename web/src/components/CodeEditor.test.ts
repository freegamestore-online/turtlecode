import { describe, it, expect } from "vitest";
import { highlightCode } from "./CodeEditor";

/** The text a user sees: highlighted HTML with tags stripped and entities decoded. */
function visibleText(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? "";
}

describe("highlightCode", () => {
  const programs = [
    "forward(100)",
    'penColor("red")\nfd(10)\nrt(90)',
    "repeat(4) { back(20); lt(45); penSize(3); pu(); pd() }",
    "color('blue') // comment with forward(1)",
  ];

  for (const code of programs) {
    it(`shows exactly the source text: ${JSON.stringify(code)}`, () => {
      expect(visibleText(highlightCode(code))).toBe(code);
    });
  }

  it("colours each token once", () => {
    expect(highlightCode("forward(100)")).toBe(
      '<span style="color:#61afef">forward</span>(<span style="color:#d19a66">100</span>)',
    );
  });
});
