import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import nMark from "../../../public/brand/n-mark.png";

export function BrandLogo({
  href = "/",
  className,
  variant = "full",
}: {
  href?: string;
  className?: string;
  variant?: "full" | "mark";
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="flex size-7 items-center justify-center overflow-hidden rounded-lg glow-gold">
        <Image src={nMark} alt="NightLifeNext" className="size-full object-cover" />
      </span>
      {variant === "full" && (
        <span className="text-display text-base">
          NightLife<span className="text-gradient-gold">Next</span>
        </span>
      )}
    </Link>
  );
}
