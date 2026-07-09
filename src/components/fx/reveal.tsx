"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * Scroll-triggered entrance. Wrap any block; when it enters the viewport it
 * fades and slides up. Pass `stagger` to cascade the wrapper's direct children
 * instead of animating the wrapper as one unit.
 */
export function Reveal({
  children,
  className,
  y = 32,
  delay = 0,
  stagger = 0,
  duration = 0.9,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  stagger?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const targets: gsap.TweenTarget = stagger > 0 ? Array.from(ref.current.children) : ref.current;
      gsap.from(targets, {
        opacity: 0,
        y,
        duration,
        delay,
        stagger,
        ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 88%", once: true },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
