import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
  return (
    <>
      <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
        <Link href="/demo">Live demo</Link>
      </Button>
      <Button size="sm" asChild><Link href="/lead">Get started</Link></Button>
    </>
  );
}

export function DemoPublicFooter() {
  return (
    <div className="flex gap-4">
      <Link href="/demo" className="hover:text-foreground">Demo tour</Link>
      <Link href="/g/demo-table" className="hover:text-foreground">Guest demo</Link>
    </div>
  );
}
