/**
 * Pure CSV rendering for saved reports — shared by the server report engine
 * (scheduled/downloaded runs) and the demo-mode client export. Keep free of
 * server imports: this file must stay client-bundle safe.
 */
import type { HistoricalAnalytics, ReportMetric } from "@/lib/types";

function escapeCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function renderCsv(
  reportName: string,
  metrics: ReportMetric[],
  data: HistoricalAnalytics,
): string {
  const rows: string[][] = [
    ["Report", reportName],
    ["Range", `${data.from} → ${data.to} (${data.days} nights)`],
    [],
  ];

  if (metrics.includes("revenue")) {
    rows.push(["Night", "Revenue", "Orders"]);
    for (const p of data.series) rows.push([p.label, String(p.revenue), String(p.orders)]);
    rows.push(["Total", String(data.totalRevenue), String(data.totalOrders)], []);
  }
  if (metrics.includes("zones")) {
    rows.push(["Zone", "Revenue"]);
    for (const z of data.revenueByZone) rows.push([z.zoneName, String(z.revenue)]);
    rows.push([]);
  }
  if (metrics.includes("top-items")) {
    rows.push(["Item", "Sold", "Revenue"]);
    for (const t of data.topItems) rows.push([t.name, String(t.count), String(t.revenue)]);
    rows.push([]);
  }
  if (metrics.includes("staff")) {
    rows.push(["Staff", "Role", "Orders delivered", "Avg minutes", "Revenue served", "Accept wait min", "Help resolved", "Avg help min", "Orders/hr"]);
    for (const s of data.staffPerformance)
      rows.push([s.name, s.role, String(s.ordersDelivered), String(s.avgDeliveryMinutes), String(s.revenueServed), String(s.avgAcceptMinutes ?? ""), String(s.helpResolved ?? ""), String(s.avgHelpMinutes ?? ""), String(s.ordersPerShiftHour ?? "")]);
    rows.push([]);
  }
  if (metrics.includes("inventory")) {
    rows.push(["Category", "Units sold", "In stock", "Sell-through", "Sold-out min", "Restock units"]);
    for (const c of data.categoryDepletion)
      rows.push([c.categoryName, String(c.unitsSold), String(c.unitsInStock), String(c.sellThrough ?? ""), String(c.soldOutMinutes ?? ""), String(c.restockUnits ?? "")]);
    rows.push([]);
  }
  if (metrics.includes("sessions") && data.sessions) {
    const s = data.sessions;
    rows.push(["Sessions"]);
    rows.push(["Total sessions", String(s.totalSessions)]);
    rows.push(["Approval rate", String(s.approvalRate)]);
    rows.push(["Denial rate", String(s.denialRate)]);
    rows.push(["Avg approval min", String(s.avgApprovalMinutes)]);
    rows.push(["Avg duration min", String(s.avgDurationMinutes)]);
    rows.push(["Avg party size", String(s.avgPartySize)]);
    rows.push(["Revenue / session", String(s.revenuePerSession)]);
    rows.push(["Revenue / guest", String(s.revenuePerGuest)]);
    rows.push(["Avg closure min", String(s.avgClosureMinutes)]);
    rows.push(["Tab settlement (staff-recorded)", "Count", "Pct"]);
    for (const m of s.settlementMix) rows.push([m.method, String(m.count), String(m.pct)]);
    rows.push([]);
  }
  if (metrics.includes("reservations") && data.reservations) {
    const r = data.reservations;
    rows.push(["Reservations"]);
    rows.push(["Requested", "Confirmed", "Seated", "Completed", "Cancelled", "No-show rate", "Avg lead days", "Total covers"]);
    rows.push([String(r.requested), String(r.confirmed), String(r.seated), String(r.completed), String(r.cancelled), String(r.noShowRate), String(r.avgLeadDays), String(r.totalCovers)]);
    rows.push(["Source", "Count", "Pct"]);
    for (const s of r.sourceSplit) rows.push([s.source, String(s.count), String(s.pct)]);
    rows.push([]);
  }
  if (metrics.includes("happy-hours") && data.happyHours) {
    const h = data.happyHours;
    rows.push(["Happy Hours"]);
    rows.push(["Total HH orders", String(h.totalHhOrders)]);
    rows.push(["Total HH revenue", String(h.totalHhRevenue)]);
    rows.push(["Total discount given", String(h.totalDiscountGiven)]);
    rows.push(["Rule", "Orders", "Revenue", "Discount", "Category uplift"]);
    for (const r of h.rules) rows.push([r.ruleName, String(r.orders), String(r.revenue), String(r.discountGiven), String(r.categoryUpliftPct)]);
    rows.push([]);
  }
  if (metrics.includes("events") && data.events) {
    rows.push(["Events"]);
    rows.push(["Event", "Invited", "Confirmed", "Checked in", "Utilization", "Event revenue", "Avg weekday revenue"]);
    for (const e of data.events.events)
      rows.push([e.eventName, String(e.invited), String(e.confirmed), String(e.checkedIn), String(e.capacityUtilization), String(e.eventRevenue), String(e.avgWeekdayRevenue)]);
    rows.push([]);
  }
  if (metrics.includes("promotions") && data.promotions) {
    rows.push(["Promotions"]);
    rows.push(["Code", "Redemptions", "Discount cost", "Attributed revenue", "AOV with promo", "AOV without promo"]);
    for (const p of data.promotions.promotions)
      rows.push([p.code, String(p.redemptions), String(p.discountCost), String(p.attributedRevenue), String(p.aovWithPromo), String(p.aovWithoutPromo)]);
    rows.push([]);
  }
  if (metrics.includes("order-funnel") && data.orderFunnel) {
    const f = data.orderFunnel;
    rows.push(["Order Funnel"]);
    rows.push(["Placed", "Accepted", "Delivered", "Cancelled", "Cancellation rate", "Tip rate", "Avg tip", "Service fee revenue", "Gift orders", "Gift revenue", "Modifier attach rate"]);
    rows.push([String(f.placed), String(f.accepted), String(f.delivered), String(f.cancelled), String(f.cancellationRate), String(f.tipRate), String(f.avgTip), String(f.serviceFeeRevenue), String(f.giftOrders), String(f.giftRevenue), String(f.modifierAttachRate)]);
    rows.push([]);
  }
  if (metrics.includes("service-fees") && data.orderFunnel) {
    rows.push(["Service Fees"]);
    rows.push(["Service fee revenue", String(data.orderFunnel.serviceFeeRevenue)]);
    rows.push([]);
  }
  if (metrics.includes("promoter-funnel") && data.promoters) {
    rows.push(["Promoter Funnel"]);
    rows.push(["Promoter", "Created", "Confirmed", "Seated", "Show-up rate", "Guests funneled"]);
    for (const p of data.promoters.promoters)
      rows.push([p.promoterName, String(p.reservationsCreated), String(p.reservationsConfirmed), String(p.reservationsSeated), String(p.showUpRate), String(p.guestsFunneled)]);
    rows.push(["Total", "", "", "", "", String(data.promoters.totalGuestsFunneled)]);
    rows.push([]);
  }
  if (metrics.includes("promoter-revenue") && data.promoters) {
    rows.push(["Promoter Revenue"]);
    rows.push(["Promoter", "Attributed revenue", "Avg spend/guest", "Avg spend/party", "Top table", "Top table revenue"]);
    for (const p of data.promoters.promoters)
      rows.push([p.promoterName, String(p.attributedRevenue), String(p.avgSpendPerGuest), String(p.avgSpendPerParty), p.topTable?.tableCode ?? "", String(p.topTable?.revenue ?? "")]);
    rows.push(["Total", String(data.promoters.totalAttributedRevenue), "", "", "", ""]);
    rows.push([]);
  }

  return rows.map((r) => r.map(escapeCell).join(",")).join("\n");
}
