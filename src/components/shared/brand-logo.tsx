import Link from "next/link";
import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary glow-primary">
        <Moon className="size-4" />
      </span>
      <span className="tracking-tight">
        NightLife<span className="text-gradient-brand">Next</span>
      </span>
    </Link>
  );
}
