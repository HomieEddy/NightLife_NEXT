"use client";
import type { ReactNode } from "react";

export function FadeIn({ show, children }: { show: boolean; children: ReactNode }) {
  return <div className={show ? "animate-fade-in" : "opacity-0"}>{children}</div>;
}
