import Link from "next/link";

import { Button } from "@/components/ui/button";

export const deniedSessionPath = "/";

export function DemoOpenTableAction() { return null; }
export function DemoQrScanAction() { return null; }
export function DemoNewSessionAction() { return null; }
export function DemoManagerGuestFlowAction() { return null; }
export function DemoPublicNav() {
  return (
    <Button size="sm" asChild>
      <Link href="/login">Log in</Link>
    </Button>
  );
}
export function DemoPublicFooter() { return null; }
