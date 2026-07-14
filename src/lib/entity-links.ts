/**
 * Cross-page entity link builders — target URLs live in one place.
 * Each target page is responsible for reading its own query param.
 * See docs/superpowers/specs/2026-07-08-navigation-cross-linking-design.md
 */

export const zoneTablesHref = (zoneId: string) => `/manager/tables?zone=${zoneId}`;
export const zoneStaffHref = (zoneId: string) => `/manager/staff?zone=${zoneId}`;
export const zoneHref = (zoneId: string) => `/manager/zones?highlight=${zoneId}`;
export const tableHref = (tableId: string) => `/manager/tables?highlight=${tableId}`;
export const staffOrdersHref = (tableId: string) => `/staff/orders?table=${tableId}`;
export const menuCategoryHref = (categoryId: string) => `/manager/menu?category=${categoryId}`;
export const reservationHref = (resId: string) => `/manager/reservations?highlight=${resId}`;
export const eventHref = (eventId: string) => `/manager/events?highlight=${eventId}`;
export const promotionHref = (promoId: string) => `/manager/promotions?highlight=${promoId}`;
