"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/features/shared/utils";

type Tint = "gold" | "violet" | "cyan";

interface SpotlightConfig {
  /** Anchor position, % from left of the container. */
  anchor: number;
  /** Cone width at its base, in px. */
  width: number;
  /** Max degrees the beam swings off vertical while tracking the pointer. */
  maxSwing: number;
  /** Smoothing factor per frame — lower drags further behind the cursor. */
  lag: number;
  tint: Tint;
}

const SPOTLIGHTS: SpotlightConfig[] = [
  { anchor: 16, width: 220, maxSwing: 32, lag: 0.05, tint: "gold" },
  { anchor: 40, width: 280, maxSwing: 24, lag: 0.065, tint: "violet" },
  { anchor: 62, width: 260, maxSwing: 28, lag: 0.055, tint: "gold" },
  { anchor: 86, width: 200, maxSwing: 34, lag: 0.045, tint: "cyan" },
];

const TINT_COLOR: Record<Tint, string> = {
  gold: "oklch(from var(--gold) l c h",
  violet: "168 85 247",
  cyan: "34 211 238",
};

function tintChannel(tint: Tint, alpha: number) {
  return tint === "gold"
    ? `oklch(from var(--gold) l c h / ${alpha}%)`
    : `rgb(${TINT_COLOR[tint]} / ${alpha}%)`;
}

/** Tapered beam fill — bright near the fixture, fading toward the floor. */
function beamGradient(tint: Tint, core: number, mid: number) {
  return `linear-gradient(to bottom, ${tintChannel(tint, core)}, ${tintChannel(tint, mid)} 45%, transparent 85%)`;
}

/** Soft round glow — for the fixture head and the pool where the beam lands. */
function radialGlow(tint: Tint, alpha: number) {
  return `radial-gradient(circle, ${tintChannel(tint, alpha)}, transparent 70%)`;
}

/**
 * Stage-light cones anchored to the top of the hero, swiveling to track the
 * pointer like real fixtures follow a performer across the floor. Each beam
 * lags the cursor by its own smoothing factor so the sweep reads as physical
 * movement, not a snap. Purely decorative: pointer-events disabled, angles
 * freeze under prefers-reduced-motion.
 */
export function Spotlights({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const beamRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const applyAngle = (i: number, angle: number) => {
      const beam = beamRefs.current[i];
      if (beam) beam.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    };

    if (reduced) {
      SPOTLIGHTS.forEach((_, i) => applyAngle(i, (i - (SPOTLIGHTS.length - 1) / 2) * 8));
      return;
    }

    const angles = SPOTLIGHTS.map(() => 0);
    let pointerX: number | null = null;
    let pointerY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    let raf = 0;
    const tick = () => {
      const rect = el.getBoundingClientRect();
      SPOTLIGHTS.forEach((cfg, i) => {
        const anchorX = (cfg.anchor / 100) * rect.width;
        let target = 0;
        if (pointerX !== null) {
          const dx = pointerX - anchorX;
          const dy = Math.max(pointerY, 80);
          target = Math.atan2(dx, dy) * (180 / Math.PI);
          target = Math.max(-cfg.maxSwing, Math.min(cfg.maxSwing, target));
        }
        angles[i] += (target - angles[i]) * cfg.lag;
        applyAngle(i, angles[i]);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {SPOTLIGHTS.map((cfg, i) => (
        // Pivot wrapper: statically centered on the anchor (no translate in
        // the transform, or composing it with `rotate` pivots around the
        // wrong point and the beam swings opposite the cursor). Only
        // `rotate` is ever set on this node, around its top-center origin.
        <div
          key={i}
          ref={(node) => {
            beamRefs.current[i] = node;
          }}
          className="absolute top-0 origin-top mix-blend-screen"
          style={{
            left: `calc(${cfg.anchor}% - ${cfg.width / 2}px)`,
            width: cfg.width,
            height: "64vh",
          }}
        >
          {/* Halo — wide, soft, sets the ambient glow of the beam */}
          <div
            className="absolute inset-0 blur-lg"
            style={{
              clipPath: "polygon(50% 0%, 4% 100%, 96% 100%)",
              background: beamGradient(cfg.tint, 32, 8),
            }}
          />
          {/* Core — narrower, brighter shaft inside the halo */}
          <div
            className="absolute inset-x-0 top-0 mx-auto blur-[3px]"
            style={{
              width: "42%",
              height: "100%",
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
              background: beamGradient(cfg.tint, 55, 14),
            }}
          />
          {/* Fixture — the little glowing lamp head the beam comes from */}
          <div
            className="absolute left-1/2 top-0 size-4 -translate-x-1/2 -translate-y-1/2 blur-[1px]"
            style={{ background: radialGlow(cfg.tint, 95) }}
          />
          {/* Ground pool — where the beam lands */}
          <div
            className="absolute bottom-0 left-1/2 h-14 w-[130%] -translate-x-1/2 translate-y-1/3 blur-xl"
            style={{ background: radialGlow(cfg.tint, 45) }}
          />
        </div>
      ))}
    </div>
  );
}
