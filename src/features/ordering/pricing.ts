/**
 * The pricing engine — one module for order money math: subtotal, happy-hour
 * discounts, promotions and service fees. Pure: no I/O, no side effects.
 * All internal math is integer cents; dollars only cross the two presentation
 * adapters at the bottom of this file.
 *
 * Semantic authority: the cents engine (`computeOrderPricing`) is canonical —
 * the demo track mirrors it, never the other way around.
 */
import { bestHappyHourDiscount, type HappyHourDiscountRule } from "@/lib/happy-hour";
import { toCents, fromCents } from "@/features/shared/money";
import type { FeeLine } from "./fees";
import type { CartLine, HappyHourRule, Promotion, ServiceFee, Venue } from "@/lib/types";

// ── Input types ───────────────────────────────────────────────────────

export interface PricingLineInput {
  menuItemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  categoryId: string;
  modifiers: { groupName: string; optionName: string; deltaCents: number; quantity?: number }[];
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

export type HappyHourInput = HappyHourDiscountRule;

export interface PromotionInput {
  /** Number is a percent for percentage, a dollar amount for flat. */
  type: "percentage" | "flat";
  value: number;
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
  happyHourRuleId?: string;
  promotionCents: number;
  discountedSubtotalCents: number;
  feeLines: FeeLineResult[];
  totalFeeCents: number;
  tipCents: number;
  totalCents: number;
}

function pricingLineTotal(line: PricingLineInput): number {
  return line.priceCents * line.quantity + line.modifiers.reduce(
    (sum, modifier) => sum + modifier.deltaCents * (modifier.quantity ?? 1),
    0,
  );
}

/** Fees on a post-discount subtotal — the single application of the fee rules. */
function feeLinesForCents(subtotalCents: number, fees: FeeInput[]): FeeLineResult[] {
  return fees.map((fee) =>
    fee.type === "percentage"
      ? {
          feeId: fee.id,
          feeName: fee.name,
          feeType: "percentage",
          feeValue: fee.value,
          amountCents: Math.round(subtotalCents * fee.value / 10000),
        }
      : {
          feeId: fee.id,
          feeName: fee.name,
          feeType: "flat",
          feeValue: fee.valueCents,
          amountCents: fee.valueCents,
        },
  );
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
    subtotalCents += pricingLineTotal(line);
  }

  // 2. Happy-hour discount: per line, the best matching rule wins
  let discountCents = 0;
  let happyHourRuleId: string | undefined;

  for (const line of lines) {
    const best = bestHappyHourDiscount(happyHourRules, line.categoryId, now);
    if (best && best.discountPct > 0) {
      discountCents += Math.round(pricingLineTotal(line) * best.discountPct / 100);
      happyHourRuleId = best.ruleId;
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
          const lineTotal = pricingLineTotal(line);
          // Subtract line's share of the happy-hour discount before applying promo
          const best = bestHappyHourDiscount(happyHourRules, line.categoryId, now);
          const lineHhDiscount = best ? Math.round(lineTotal * best.discountPct / 100) : 0;
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
  const feeLines = feeLinesForCents(discountedSubtotalCents, fees);
  const totalFeeCents = feeLines.reduce((s, f) => s + f.amountCents, 0);

  // 5. Total
  const totalCents = discountedSubtotalCents + totalFeeCents + tipCents;

  return {
    subtotalCents,
    discountCents,
    happyHourRuleId,
    promotionCents,
    discountedSubtotalCents,
    feeLines,
    totalFeeCents,
    tipCents,
    totalCents,
  };
}

// ── Dollars adapters (presentation edges) ─────────────────────────────

/** Venue fee config → fee input. Percent basis-point conversion lives here, once. */
export function venueFeeInput(fee: ServiceFee): FeeInput {
  if (fee.type === "flat") {
    return { id: fee.id, name: fee.name, type: "flat", valueCents: toCents(fee.value) };
  }
  return { id: fee.id, name: fee.name, type: "percentage", value: Math.round(fee.value * 100) };
}

/** Need the fee lines for an arbitrary subtotal (settings preview, seed, gift)? Call this. */
export function computeFeeLinesForSubtotal(subtotal: number, venue: Venue): FeeLine[] {
  if (subtotal <= 0) return [];
  const lines = feeLinesForCents(toCents(subtotal), venue.serviceFees.map(venueFeeInput));
  return venue.serviceFees.map((fee, i) => ({ fee, amount: fromCents(lines[i].amountCents) }));
}

/** Total of all configured fees for a subtotal. */
export function computeServiceFeeForSubtotal(subtotal: number, venue: Venue): number {
  return Math.round(
    computeFeeLinesForSubtotal(subtotal, venue).reduce((sum, l) => sum + l.amount, 0) * 100,
  ) / 100;
}

export interface CartPricingInput {
  lines: CartLine[];
  venue: Venue;
  happyHourRules: HappyHourRule[];
  promotion?: Promotion;
  tip: number; // dollars, 2 dp
  now: Date;
}

export interface CartPricingResult {
  subtotal: number;
  happyHourDiscount: number;
  happyHourDiscountCents: number;
  happyHourRuleId?: string;
  promoDiscount: number;
  promoDiscountCents: number;
  afterDiscounts: number;
  feeLines: FeeLine[];
  serviceFee: number;
  tip: number;
  total: number;
  totalCents: number;
}

/**
 * Dollars adapter for cart-shaped callers (guest cart preview, demo order
 * service). Converts to cents, runs the canonical engine, returns dollars —
 * exactly one rounding boundary per amount.
 */
export function computeCartPricing(input: CartPricingInput): CartPricingResult {
  const { lines, venue, happyHourRules, promotion, tip, now } = input;
  const pricing = computeOrderPricing({
    lines: lines.map((line) => ({
      menuItemId: line.menuItem.id,
      name: line.menuItem.name,
      priceCents: toCents(line.menuItem.price),
      quantity: line.quantity,
      categoryId: line.menuItem.categoryId,
      modifiers: line.modifiers.map((modifier) => ({
        groupName: modifier.groupName,
        optionName: modifier.optionName,
        deltaCents: toCents(modifier.priceDelta),
        quantity: modifier.quantity,
      })),
    })),
    fees: venue.serviceFees.map(venueFeeInput),
    happyHourRules,
    promotion: promotion
      ? { type: promotion.type, value: promotion.value, appliesToCategoryIds: promotion.appliesToCategoryIds }
      : undefined,
    tipCents: toCents(tip),
    now,
  });

  return {
    subtotal: fromCents(pricing.subtotalCents),
    happyHourDiscount: fromCents(pricing.discountCents),
    happyHourDiscountCents: pricing.discountCents,
    happyHourRuleId: pricing.happyHourRuleId,
    promoDiscount: fromCents(pricing.promotionCents),
    promoDiscountCents: pricing.promotionCents,
    afterDiscounts: fromCents(pricing.discountedSubtotalCents),
    feeLines: venue.serviceFees.map((fee, i) => ({
      fee,
      amount: fromCents(pricing.feeLines[i].amountCents),
    })),
    serviceFee: fromCents(pricing.totalFeeCents),
    tip: fromCents(pricing.tipCents),
    total: fromCents(pricing.totalCents),
    totalCents: pricing.totalCents,
  };
}
