import { mockMenuService } from "@/features/menu/mock-service";
import { liveMenuService } from "@/features/menu/live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";
export type { PackageQuote } from "@/lib/types";

export type MenuService = typeof mockMenuService;

export const menuService: MenuService = isDemoMode()
  ? demoOnlyService(mockMenuService)
  : liveOnlyService(liveMenuService);
