import Image from "next/image";
import nMark from "../../public/brand/n-mark-128.png";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="size-16 overflow-hidden rounded-2xl animate-glow-pulse">
        <Image src={nMark} alt="" className="size-full object-cover" priority />
      </div>
    </div>
  );
}
