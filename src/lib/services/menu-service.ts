import { mockMenuService } from "@/lib/mock-services/menu-service";
import { liveMenuService } from "@/lib/live-services/menu-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";
export type { PackageQuote } from "@/lib/types";

export type MenuService = typeof mockMenuService;

export const menuService: MenuService = isDemoMode()
  ? demoOnlyService(mockMenuService)
  : liveOnlyService(liveMenuService);
