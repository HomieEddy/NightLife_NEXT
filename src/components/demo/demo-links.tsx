"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const deniedSessionPath = "/g/demo-table";

export function DemoOpenTableAction() {
  return <Button asChild><Link href="/g/demo-table">Open demo table</Link></Button>;
}

export function DemoQrScanAction() {
  return <Button asChild><Link href="/g/demo-table">Simulate scanning a QR</Link></Button>;
}

export function DemoNewSessionAction() {
  return (
    <Button variant="outline" className="w-full animate-fade-up" asChild>
      <Link href="/g/demo-table">Start a new session</Link>
    </Button>
  );
}

export function DemoManagerGuestFlowAction() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href="/g/demo-table"><ExternalLink className="size-3.5" /> Test guest flow</Link>
    </Button>
  );
}

export function DemoPublicNav() {
  const pathname = usePathname();
  return (
    <>
      {pathname !== "/demo" && (
        <Button variant="ghost" size="sm" asChild>
          <Link href="/demo"><ArrowLeft className="size-4" /> Back to demo</Link>
        </Button>
      )}
      <Button size="sm" asChild>
        <Link href="/login">Log in</Link>
      </Button>
    </>
  );
}

export function DemoPublicFooter() {
  return null;
}
