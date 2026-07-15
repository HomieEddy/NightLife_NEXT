import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LIVE_APP_URL } from "@/lib/app-origins";

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
    <Button variant="ghost" size="sm" asChild>
      <Link href={LIVE_APP_URL}><ArrowLeft className="size-4" /> Back to NightLifeNext</Link>
    </Button>
  );
}

export function DemoPublicFooter() {
  return null;
}
