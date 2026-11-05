import type { Level, LineSegment } from "../types";
import { execute } from "./interpreter";

/** How far (px) a drawn line may be from the target and still count. */
const TOLERANCE = 4;
/** Distance (px) between the points sampled along each segment. */
const SAMPLE_SPACING = 5;

/** The target trail for a level: what its reference solution draws. */
export function levelTarget(level: Level): LineSegment[] {
  if (!level.solution) return [];
  const { steps } = execute(level.solution);
  return steps[steps.length - 1]!.state.trail;
}

function samplePoints(seg: LineSegment): { x: number; y: number }[] {
  const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
  const n = Math.max(1, Math.ceil(len / SAMPLE_SPACING));
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: seg.x1 + ((seg.x2 - seg.x1) * i) / n,
    y: seg.y1 + ((seg.y2 - seg.y1) * i) / n,
  }));
}

function distanceToSegment(p: { x: number; y: number }, seg: LineSegment): number {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const lenSq = dx * dx + dy * dy;
  const t =
    lenSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - seg.x1) * dx + (p.y - seg.y1) * dy) / lenSq));
  return Math.hypot(p.x - (seg.x1 + t * dx), p.y - (seg.y1 + t * dy));
}

/** Every point along `a` lies on some segment of `b` (with the same pen, if `matchStyle`). */
function covers(a: LineSegment[], b: LineSegment[], matchStyle: boolean): boolean {
  return a.every((segA) => {
    const candidates = matchStyle
      ? b.filter((segB) => segB.color === segA.color && segB.width === segA.width)
      : b;
    return samplePoints(segA).every((p) =>
      candidates.some((segB) => distanceToSegment(p, segB) <= TOLERANCE),
    );
  });
}

/**
 * Does the drawing match the target? Order- and direction-independent: the
 * drawing must trace every part of the target and nothing outside it.
 */
export function matchesTarget(
  drawn: LineSegment[],
  target: LineSegment[],
  matchStyle = false,
): boolean {
  if (drawn.length === 0) return false;
  return covers(target, drawn, matchStyle) && covers(drawn, target, matchStyle);
}
