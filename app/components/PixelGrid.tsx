"use client";

import { useEffect, useRef, type RefObject } from "react";

// Dot-matrix visualizer: a pixel mic at rest, red level bars while
// recording, a yellow sweep while the quote is being analyzed.

export type GridMode = "idle" | "recording" | "busy";

const COLS = 11;
const ROWS = 13;

const MIC = [
  "....###....",
  "...#####...",
  "...#####...",
  "...#####...",
  "...#####...",
  ".#.#####.#.",
  ".#..###..#.",
  "..#.....#..",
  "...#####...",
  ".....#.....",
  "...#####...",
];
const MIC_TOP = 1;

const INK = "#161616";
const RED = "#e5322d";
const YELLOW = "#ffd400";
const EMPTY_FILL = "rgba(255,255,255,0.55)";
const EMPTY_STROKE = "rgba(0,0,0,0.06)";

export function PixelGrid({
  mode,
  analyserRef,
}: {
  mode: GridMode;
  analyserRef: RefObject<AnalyserNode | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bins = new Uint8Array(32);
    let frame = 0;
    let raf = 0;

    const layout = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const cell = width / COLS;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(cell * ROWS * dpr);
      canvas.style.height = `${cell * ROWS}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return cell;
    };
    let cell = layout();

    const drawCell = (c: number, r: number, color: string | null) => {
      const gap = cell * 0.1;
      const x = c * cell + gap / 2;
      const y = r * cell + gap / 2;
      const s = cell - gap;
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, s * 0.22);
      if (color) {
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.fillStyle = EMPTY_FILL;
        ctx.fill();
        ctx.strokeStyle = EMPTY_STROKE;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    // Color for each cell this frame, or null for an empty cell
    const colorAt = (c: number, r: number, t: number): string | null => {
      if (mode === "idle") {
        return MIC[r - MIC_TOP]?.[c] === "#" ? INK : null;
      }
      if (mode === "busy") {
        const phase = (c + r * 0.6) * 0.7 - t * 0.12;
        const v = Math.sin(phase);
        if (v > 0.92) return YELLOW;
        if (v > 0.75) return "rgba(255, 212, 0, 0.45)";
        return null;
      }
      // recording: mirrored bars from the center column, centered vertically
      const d = Math.abs(c - (COLS - 1) / 2);
      const level = (bins[Math.min(31, 1 + d * 2)] ?? 0) / 255;
      // Curve keeps normal speech in the middle rows; only loud peaks fill the grid
      const half = Math.round(Math.pow(level, 1.8) * (ROWS / 2));
      const center = (ROWS - 1) / 2;
      const dist = Math.abs(r - center);
      if (dist <= Math.max(0.5, half)) return dist >= half - 0.5 && half > 1 ? "#b8211d" : RED;
      return null;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const analyser = analyserRef.current;
      if (mode === "recording" && analyser) analyser.getByteFrequencyData(bins);
      else bins.fill(mode === "recording" ? 40 : 0);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) drawCell(c, r, colorAt(c, r, frame));
      }
      frame++;
      if (mode !== "idle" && !reduceMotion) raf = requestAnimationFrame(draw);
    };
    draw();

    const observer = new ResizeObserver(() => {
      cell = layout();
      if (mode === "idle" || reduceMotion) draw();
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [mode, analyserRef]);

  return <canvas ref={canvasRef} className="pixel-grid" aria-hidden />;
}
