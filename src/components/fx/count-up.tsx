"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Animates a number from 0 to `value` when it scrolls into view. */
export function CountUp({
  value,
  format = (v: number) => String(Math.round(v)),
  duration = 1.6,
  className,
  startOnMount = false,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
  startOnMount?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const state = { v: 0 };
      const tween = {
        v: value,
        duration,
        ease: "power2.out",
        scrollTrigger: startOnMount
          ? undefined
          : { trigger: ref.current, start: "top 92%", once: true },
        onUpdate: () => {
          if (ref.current) ref.current.textContent = format(state.v);
        },
      };
      gsap.to(state, tween);
    },
    { dependencies: [value], scope: ref },
  );

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  );
}
