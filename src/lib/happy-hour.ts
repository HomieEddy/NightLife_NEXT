/**
 * Happy-hour window + discount selection, shared by the live pricing engine
 * (src/server/pricing.ts) and the demo order/cart path. Pure — no I/O.
 */

export interface HappyHourWindow {
  isActive: boolean;
  daysOfWeek: number[]; // 0 = Sunday
  startTime: string; // "HH:MM"
  endTime: string;
}

export interface HappyHourDiscountRule extends HappyHourWindow {
  id: string;
  discountPct: number;
  appliesToCategoryIds: string[];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function isInHappyHourWindow(rule: HappyHourWindow, now: Date): boolean {
  if (!rule.isActive) return false;

  const dayOfWeek = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(rule.startTime);
  const end = timeToMinutes(rule.endTime);

  const crossesMidnight = end <= start;

  if (crossesMidnight) {
    // Window like 22:00–02:00: check if we're in the late part (22:00–23:59)
    // on a matching day, or in the early part (00:00–02:00) on the day after.
    if (nowMinutes >= start && rule.daysOfWeek.includes(dayOfWeek)) return true;
    const yesterday = (dayOfWeek + 6) % 7;
    if (nowMinutes < end && rule.daysOfWeek.includes(yesterday)) return true;
    return false;
  }

  return rule.daysOfWeek.includes(dayOfWeek) && nowMinutes >= start && nowMinutes < end;
}

/**
 * Highest active discount covering the category — empty appliesToCategoryIds
 * means the rule covers every category. Null when no rule applies.
 */
export function bestHappyHourDiscount(
  rules: HappyHourDiscountRule[],
  categoryId: string,
  now: Date,
): { ruleId: string; discountPct: number } | null {
  let best: { ruleId: string; discountPct: number } | null = null;
  for (const rule of rules) {
    if (!isInHappyHourWindow(rule, now)) continue;
    const applies =
      rule.appliesToCategoryIds.length === 0 || rule.appliesToCategoryIds.includes(categoryId);
    if (applies && rule.discountPct > (best?.discountPct ?? 0)) {
      best = { ruleId: rule.id, discountPct: rule.discountPct };
    }
  }
  return best;
}

export interface DiscountableLine {
  unitPrice: number;
  quantity: number;
  categoryId: string | undefined; // undefined = package line
  addOns: { priceDelta: number; quantity: number }[];
}

/**
 * Total happy-hour discount for a cart, rounded to cents. Same rule selection
 * as the live pricing engine; the cart preview and the demo order service must
 * agree on this number, so both call here.
 */
export function cartHappyHourDiscount(
  rules: HappyHourDiscountRule[],
  lines: DiscountableLine[],
  now: Date,
): { discount: number; ruleId: string | undefined } {
  let discount = 0;
  let ruleId: string | undefined;
  for (const line of lines) {
    const best = bestHappyHourDiscount(rules, line.categoryId ?? "packages", now);
    if (!best) continue;
    const addOnTotal = line.addOns.reduce((sum, a) => sum + a.priceDelta * a.quantity, 0);
    const lineTotal = line.unitPrice * line.quantity + addOnTotal;
    discount += Math.round(lineTotal * best.discountPct) / 100;
    ruleId = best.ruleId;
  }
  return { discount: Math.round(discount * 100) / 100, ruleId };
}
