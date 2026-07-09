"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { formatMoney } from "@/lib/format";

/**
 * A money amount that tweens between values when it changes (e.g. cart total
 * reacting to tip selection) with a small scale pop.
 */
export function AnimatedMoney({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (previous.current === value) {
      el.textContent = formatMoney(value);
      return;
    }
    const state = { v: previous.current };
    previous.current = value;
    const tween = gsap.to(state, {
      v: value,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = formatMoney(state.v);
      },
      onComplete: () => {
        el.textContent = formatMoney(value);
      },
    });
    const pop = gsap.fromTo(
      el,
      { scale: 1.12 },
      { scale: 1, duration: 0.35, ease: "back.out(2.5)" },
    );
    return () => {
      tween.kill();
      pop.kill();
    };
  }, [value]);

  return (
    <span ref={ref} className={`inline-block tabular-nums ${className ?? ""}`}>
      {formatMoney(value)}
    </span>
  );
}
