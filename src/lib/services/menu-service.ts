import { mockMenuService } from "@/lib/mock-services/menu-service";
export type { PackageQuote } from "@/lib/mock-services/menu-service";

export type MenuService = typeof mockMenuService;

export const menuService: MenuService = mockMenuService;
