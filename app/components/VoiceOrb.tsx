"use client";

import { useEffect, useRef, type RefObject } from "react";

// Organic voice orb: layered wavy contours drawn as a fine line mesh with a
// soft glow. Breathes at rest, swells with the voice while recording,
// spins and shimmers while the quote is analyzed.

export type OrbMode = "idle" | "recording" | "busy";

type RGB = [number, number, number];

interface Layer {
  color: RGB;
  lines: number; // concentric strokes that form the mesh
  base: number; // radius as a fraction of the stage
  harmonics: [k: number, weight: number, phase: number][];
  speed: number;
  bins: [from: number, to: number]; // frequency band driving this layer
}

// Tape-measure palette: yellow blade, orange, red numbers — saturated enough
// to read on the app's light gray background
const LAYERS: Layer[] = [
  { color: [242, 182, 0], lines: 18, base: 0.72, harmonics: [[3, 0.7, 0], [5, 0.4, 1.3], [2, 0.35, 2.1]], speed: 0.55, bins: [1, 4] },
  { color: [255, 122, 26], lines: 16, base: 0.63, harmonics: [[4, 0.6, 0.7], [6, 0.35, 2.4], [3, 0.4, 4.0]], speed: -0.45, bins: [3, 8] },
  { color: [229, 50, 45], lines: 14, base: 0.54, harmonics: [[5, 0.55, 1.9], [3, 0.5, 0.4], [7, 0.25, 3.3]], speed: 0.75, bins: [6, 14] },
];

const POINTS = 96;
const TAU = Math.PI * 2;

const rgba = ([r, g, b]: RGB, a: number) => `rgba(${r},${g},${b},${a.toFixed(3)})`;

export function VoiceOrb({
  mode,
  analyserRef,
}: {
  mode: OrbMode;
  analyserRef: RefObject<AnalyserNode | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bins = new Uint8Array(32);
    // Smoothed energy per layer + overall, so the shape eases instead of jittering
    const energy = LAYERS.map(() => 0);
    let level = 0;
    let size = 0;
    let raf = 0;
    const start = performance.now();

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = canvas.clientWidth;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    layout();

    const bandLevel = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i <= to; i++) sum += bins[i];
      return sum / ((to - from + 1) * 255);
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const analyser = analyserRef.current;
      if (mode === "recording" && analyser) analyser.getByteFrequencyData(bins);
      else bins.fill(0);

      const target = mode === "recording" ? bandLevel(1, 14) : 0;
      level += (target - level) * 0.18;

      const cx = size / 2;
      const cy = size / 2;
      const R = size / 2;

      ctx.clearRect(0, 0, size, size);

      // Halo behind everything
      const breath = 0.5 + 0.5 * Math.sin(t * 1.2);
      const halo = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      halo.addColorStop(0, rgba([255, 212, 0], 0.3 + level * 0.3 + breath * 0.05));
      halo.addColorStop(0.6, rgba([255, 170, 0], 0.08 + level * 0.1));
      halo.addColorStop(1, "rgba(255,212,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);


      const spin = mode === "busy" ? t * 0.9 : t * 0.08;
      const pace = mode === "busy" ? 2.2 : mode === "recording" ? 1.4 : 0.6;

      LAYERS.forEach((layer, li) => {
        const target = mode === "recording" ? bandLevel(...layer.bins) : 0;
        energy[li] += (target - energy[li]) * 0.2;

        // How far the contour departs from a circle
        const amp =
          mode === "recording"
            ? 0.05 + energy[li] * 0.42
            : mode === "busy"
              ? 0.1 + 0.05 * Math.sin(t * 3 + li)
              : 0.045 + 0.02 * breath;
        const radius = R * layer.base * (1 + level * 0.18 + (mode === "idle" ? breath * 0.03 : 0));
        const color: RGB = mode === "busy" ? [255, 212 - li * 30, li * 20] : layer.color;

        const contour = (shrink: number, lag: number) => {
          ctx.beginPath();
          for (let p = 0; p <= POINTS; p++) {
            const a = (p / POINTS) * TAU;
            let wave = 0;
            for (const [k, w, ph] of layer.harmonics) {
              wave += w * Math.sin(k * a + ph + t * layer.speed * pace * k * 0.35 - lag);
            }
            const r = radius * shrink * (1 + amp * wave * 0.5);
            const rot = a + spin * (li % 2 ? -1 : 1);
            const x = cx + r * Math.cos(rot);
            const y = cy + r * Math.sin(rot);
            if (p === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
        };

        // Translucent body, brighter towards the rim
        contour(1, 0);
        const body = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.1);
        body.addColorStop(0, rgba(color, 0.03));
        body.addColorStop(0.75, rgba(color, 0.12 + level * 0.12));
        body.addColorStop(1, rgba(color, 0.24 + level * 0.15));
        ctx.fillStyle = body;
        ctx.fill();

        // Fine mesh of concentric strokes
        ctx.lineWidth = 0.8;
        for (let j = 1; j < layer.lines; j++) {
          const alpha =
            (0.08 + 0.45 * (1 - j / layer.lines)) *
            (mode === "busy" ? 0.8 + 0.2 * Math.sin(t * 6 + j) : 1);
          ctx.strokeStyle = rgba(color, alpha);
          contour(1 - j * 0.02, j * 0.06);
          ctx.stroke();
        }

        // Glowing rim
        contour(1, 0);
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(color, 0.9);
        ctx.shadowColor = rgba(color, 0.55);
        ctx.shadowBlur = R * (0.05 + level * 0.08);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // White-hot core, brighter with the voice
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.32 + level * 0.25));
      core.addColorStop(0, `rgba(255,230,90,${(0.45 + level * 0.45 + breath * 0.06).toFixed(3)})`);
      core.addColorStop(1, "rgba(255,212,0,0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, size, size);

      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const observer = new ResizeObserver(() => {
      layout();
      if (reduceMotion) requestAnimationFrame(draw);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [mode, analyserRef]);

  return <canvas ref={canvasRef} className="voice-orb" aria-hidden />;
}
