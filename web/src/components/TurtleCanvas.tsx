import { useRef, useEffect, useCallback, useState } from "react";
import type { TurtleState } from "../types";

interface TurtleCanvasProps {
  turtle: TurtleState;
}

const GRID_SPACING = 50;
const TURTLE_SIZE = 12;

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
) {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;

  const scaledSpacing = GRID_SPACING * zoom;
  const startX = offsetX % scaledSpacing;
  const startY = offsetY % scaledSpacing;

  for (let x = startX; x < width; x += scaledSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = startY; y < height; y += scaledSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw axis lines slightly stronger
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;

  // X axis
  ctx.beginPath();
  ctx.moveTo(0, offsetY);
  ctx.lineTo(width, offsetY);
  ctx.stroke();

  // Y axis
  ctx.beginPath();
  ctx.moveTo(offsetX, 0);
  ctx.lineTo(offsetX, height);
  ctx.stroke();
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  turtle: TurtleState,
  offsetX: number,
  offsetY: number,
  zoom: number,
) {
  for (const seg of turtle.trail) {
    ctx.beginPath();
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = seg.width * zoom;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(offsetX + seg.x1 * zoom, offsetY + seg.y1 * zoom);
    ctx.lineTo(offsetX + seg.x2 * zoom, offsetY + seg.y2 * zoom);
    ctx.stroke();
  }
}

function drawTurtle(
  ctx: CanvasRenderingContext2D,
  turtle: TurtleState,
  offsetX: number,
  offsetY: number,
  zoom: number,
) {
  const tx = offsetX + turtle.x * zoom;
  const ty = offsetY + turtle.y * zoom;
  const size = TURTLE_SIZE * zoom;

  ctx.save();
  ctx.translate(tx, ty);
  // Rotate: angle 0 = up (-90 deg in canvas), clockwise positive
  ctx.rotate(((turtle.angle - 90) * Math.PI) / 180);

  // Draw the turtle as a triangle pointing right (we rotated to correct direction)
  ctx.beginPath();
  ctx.moveTo(size, 0); // tip
  ctx.lineTo(-size * 0.6, -size * 0.5);
  ctx.lineTo(-size * 0.6, size * 0.5);
  ctx.closePath();

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Fill
  ctx.fillStyle = turtle.penDown
    ? "#0ea5e9"
    : isDark
      ? "#4b5563"
      : "#9ca3af";
  ctx.fill();

  // Outline
  ctx.strokeStyle = isDark ? "#e5e7eb" : "#1a1a1a";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  // Pen-up indicator: small "up arrow" or lifted icon
  if (!turtle.penDown) {
    ctx.save();
    ctx.font = `${Math.round(11 * zoom)}px "Manrope", system-ui, sans-serif`;
    ctx.fillStyle = isDark ? "#9ca3af" : "#6b7280";
    ctx.textAlign = "center";
    ctx.fillText("PEN UP", tx, ty - size - 4 * zoom);
    ctx.restore();
  }
}

export default function TurtleCanvas({ turtle }: TurtleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Clear
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.fillStyle = isDark ? "#181818" : "#fafbfc";
    ctx.fillRect(0, 0, width, height);

    // Center = (0, 0) in turtle coordinates
    const offsetX = width / 2;
    const offsetY = height / 2;

    drawGrid(ctx, width, height, offsetX, offsetY, zoom);
    drawTrail(ctx, turtle, offsetX, offsetY, zoom);
    drawTurtle(ctx, turtle, offsetX, offsetY, zoom);
  }, [turtle, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on window resize
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.25, 0.25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  const handleSavePng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "turtlecode-drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        className="turtle-canvas"
        style={{ display: "block", width: "100%", height: "100%" }}
      />

      {/* Zoom controls */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          display: "flex",
          gap: 4,
          background: "var(--panel)",
          borderRadius: 8,
          border: "1px solid var(--line)",
          overflow: "hidden",
        }}
      >
        <button
          onClick={handleZoomOut}
          title="Zoom out"
          style={{
            padding: "4px 10px",
            border: "none",
            background: "transparent",
            color: "var(--ink)",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {"−"}
        </button>
        <button
          onClick={handleZoomReset}
          title="Reset zoom"
          style={{
            padding: "4px 10px",
            border: "none",
            background: "transparent",
            color: "var(--muted)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            minWidth: 40,
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          title="Zoom in"
          style={{
            padding: "4px 10px",
            border: "none",
            background: "transparent",
            color: "var(--ink)",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>

      {/* Save button */}
      <button
        onClick={handleSavePng}
        title="Save as PNG"
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          padding: "4px 12px",
          background: "var(--panel)",
          borderRadius: 8,
          border: "1px solid var(--line)",
          color: "var(--muted)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {"💾 Save PNG"}
      </button>
    </div>
  );
}
