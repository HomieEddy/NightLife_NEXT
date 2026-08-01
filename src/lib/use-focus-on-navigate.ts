"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * After every route change, move focus to the page's `<h1>` (or `[data-focus-target]`).
 * This means keyboard and screen-reader users start at the content, not the top of the nav.
 */
export function useFocusOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      "h1, [data-focus-target]",
    );
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  }, [pathname]);
}
