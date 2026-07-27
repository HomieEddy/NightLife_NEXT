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
export const staffReservationsHref = (promoterId: string) => `/staff/reservations?promoter=${promoterId}`;
export const adminTenantHref = (tenantId: string) => `/admin/venues/${tenantId}`;
export const doorHref = () => `/staff/door`;
export const waitlistHref = () => `/manager/reservations?tab=waitlist`;
export const incidentHref = (incidentId: string) => `/manager/incidents?highlight=${incidentId}`;
export const guestProfileHref = (guestProfileId: string) => `/manager/guests?highlight=${guestProfileId}`;
export const publicEventsHref = (publicSlug: string) => `/e/${publicSlug}`;
export const publicReservationHref = (publicSlug: string, date?: string, eventId?: string) => {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (eventId) params.set("event", eventId);
  const qs = params.toString();
  return `/r/${publicSlug}${qs ? `?${qs}` : ""}`;
};
export const staffScheduleHref = (staffId: string) => `/manager/staff?tab=schedule&staff=${staffId}`;
export const commissionHref = () => `/manager/commission`;
export const staffCommissionHref = (staffId: string) => `/manager/commission?staff=${staffId}`;
