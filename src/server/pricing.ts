/**
 * Server-side pricing engine (R3). Pure function: items + fees + happy-hour
 * rules + tip → cents breakdown. No I/O, no side effects — exhaustively
 * unit-tested. Ports src/lib/fees.ts logic and adds happy-hour discounts.
 */

// ── Input types ───────────────────────────────────────────────────────

export interface PricingLineInput {
  menuItemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  categoryId: string;
  modifiers: { groupName: string; optionName: string; deltaCents: number }[];
  packageId?: string;
}

export interface PercentageFeeInput {
  id: string;
  name: string;
  type: "percentage";
  /** Hundredths of a percent (basis points): 5% = 500, 9.975% ≈ 998. */
  value: number;
}

export interface FlatFeeInput {
  id: string;
  name: string;
  type: "flat";
  valueCents: number;
}

export type FeeInput = PercentageFeeInput | FlatFeeInput;

export interface HappyHourInput {
  id: string;
  isActive: boolean;
  daysOfWeek: number[];
  startTime: string; // "HH:MM"
  endTime: string;
  discountPct: number;
  appliesToCategoryIds: string[];
}

export interface PromotionInput {
  type: "percentage" | "flat";
  value: number; // % for percentage, dollar amount for flat
  appliesToCategoryIds: string[]; // empty = all categories
}

export interface PricingInput {
  lines: PricingLineInput[];
  fees: FeeInput[];
  happyHourRules: HappyHourInput[];
  promotion?: PromotionInput;
  tipCents: number;
  now: Date;
}

// ── Output types ──────────────────────────────────────────────────────

export interface FeeLineResult {
  feeId: string;
  feeName: string;
  feeType: "percentage" | "flat";
  feeValue: number;
  amountCents: number;
}

export interface PricingResult {
  subtotalCents: number;
  discountCents: number;
  promotionCents: number;
  discountedSubtotalCents: number;
  feeLines: FeeLineResult[];
  totalFeeCents: number;
  tipCents: number;
  totalCents: number;
}

// ── Happy-hour time matching ──────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isInHappyHourWindow(rule: HappyHourInput, now: Date): boolean {
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

// ── Engine ────────────────────────────────────────────────────────────

export function computeOrderPricing(input: PricingInput): PricingResult {
  const { lines, fees, happyHourRules, promotion, tipCents, now } = input;

  if (lines.length === 0) {
    return {
      subtotalCents: 0,
      discountCents: 0,
      promotionCents: 0,
      discountedSubtotalCents: 0,
      feeLines: [],
      totalFeeCents: 0,
      tipCents: 0,
      totalCents: 0,
    };
  }

  // 1. Raw subtotal (before discounts)
  let subtotalCents = 0;
  for (const line of lines) {
    const modDelta = line.modifiers.reduce((s, m) => s + m.deltaCents, 0);
    subtotalCents += (line.priceCents + modDelta) * line.quantity;
  }

  // 2. Happy-hour discount: for each line, find the best matching rule
  const activeRules = happyHourRules.filter((r) => isInHappyHourWindow(r, now));
  let discountCents = 0;

  if (activeRules.length > 0) {
    for (const line of lines) {
      const modDelta = line.modifiers.reduce((s, m) => s + m.deltaCents, 0);
      const lineTotal = (line.priceCents + modDelta) * line.quantity;

      let bestPct = 0;
      for (const rule of activeRules) {
        const applies =
          rule.appliesToCategoryIds.length === 0 ||
          rule.appliesToCategoryIds.includes(line.categoryId);
        if (applies && rule.discountPct > bestPct) {
          bestPct = rule.discountPct;
        }
      }

      if (bestPct > 0) {
        discountCents += Math.round(lineTotal * bestPct / 100);
      }
    }
  }

  const afterHappyHourCents = subtotalCents - discountCents;

  // 3. Promotion discount — applies to the already-discounted price (after happy-hour)
  let promotionCents = 0;
  if (promotion) {
    if (promotion.type === "percentage") {
      // Category-scoped: discount only qualifying lines' post-happy-hour amounts
      if (promotion.appliesToCategoryIds.length > 0) {
        for (const line of lines) {
          if (!promotion.appliesToCategoryIds.includes(line.categoryId)) continue;
          const modDelta = line.modifiers.reduce((s, m) => s + m.deltaCents, 0);
          const lineTotal = (line.priceCents + modDelta) * line.quantity;
          // Subtract line's share of the happy-hour discount before applying promo
          let lineHhDiscount = 0;
          if (discountCents > 0 && activeRules.length > 0) {
            let bestPct = 0;
            for (const rule of activeRules) {
              const applies =
                rule.appliesToCategoryIds.length === 0 ||
                rule.appliesToCategoryIds.includes(line.categoryId);
              if (applies && rule.discountPct > bestPct) bestPct = rule.discountPct;
            }
            lineHhDiscount = Math.round(lineTotal * bestPct / 100);
          }
          promotionCents += Math.round((lineTotal - lineHhDiscount) * promotion.value / 100);
        }
      } else {
        promotionCents = Math.round(afterHappyHourCents * promotion.value / 100);
      }
    } else {
      // Flat discount — applies to the whole order, capped at the after-happy-hour amount
      promotionCents = Math.min(Math.round(promotion.value * 100), afterHappyHourCents);
    }
  }

  const discountedSubtotalCents = afterHappyHourCents - promotionCents;

  // 4. Fees — computed on the discounted subtotal
  const feeLines: FeeLineResult[] = [];
  for (const fee of fees) {
    if (fee.type === "percentage") {
      feeLines.push({
        feeId: fee.id,
        feeName: fee.name,
        feeType: "percentage",
        feeValue: fee.value,
        amountCents: Math.round(discountedSubtotalCents * fee.value / 10000),
      });
    } else {
      feeLines.push({
        feeId: fee.id,
        feeName: fee.name,
        feeType: "flat",
        feeValue: fee.valueCents,
        amountCents: fee.valueCents,
      });
    }
  }

  const totalFeeCents = feeLines.reduce((s, f) => s + f.amountCents, 0);

  // 5. Total
  const totalCents = discountedSubtotalCents + totalFeeCents + tipCents;

  return {
    subtotalCents,
    discountCents,
    promotionCents,
    discountedSubtotalCents,
    feeLines,
    totalFeeCents,
    tipCents,
    totalCents,
  };
}
