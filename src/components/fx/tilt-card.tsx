"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/** Subtle 3D tilt following the cursor, with a moving glow hotspot. */
export function TiltCard({
  children,
  className,
  maxTilt = 7,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      const glow = glowRef.current;
      if (!el || !glow || !window.matchMedia("(pointer: fine)").matches) return;

      const rxTo = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power2" });
      const ryTo = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power2" });

      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        ryTo((px - 0.5) * 2 * maxTilt);
        rxTo(-(py - 0.5) * 2 * maxTilt);
        gsap.to(glow, {
          opacity: 1,
          x: px * rect.width,
          y: py * rect.height,
          duration: 0.3,
        });
      };
      const onLeave = () => {
        rxTo(0);
        ryTo(0);
        gsap.to(glow, { opacity: 0, duration: 0.4 });
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      return () => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      };
    },
    { scope: ref },
  );

  return (
    <div style={{ perspective: 900 }}>
      <div
        ref={ref}
        className={cn("relative overflow-hidden will-change-transform", className)}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-16 size-32 rounded-full opacity-0"
          style={{
            background:
              "radial-gradient(circle, oklch(0.62 0.24 300 / 30%), transparent 70%)",
          }}
        />
        {children}
      </div>
    </div>
  );
}
