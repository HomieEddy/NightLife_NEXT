import { mockMenuService } from "@/lib/mock-services/menu-service";
import { liveMenuService } from "@/lib/live-services/menu-service";
import { isDemoMode } from "@/lib/app-mode";
export type { PackageQuote } from "@/lib/mock-services/menu-service";

export type MenuService = typeof mockMenuService;

export const menuService: MenuService = isDemoMode() ? mockMenuService : liveMenuService;
