import type { Json } from "@/types/database";

export type PricingRuleInput = {
  id: string;
  name: string;
  condition: Json;
  adjustment_type: string;
  amount: number | null;
  amount_max: number | null;
  sort_order: number;
  is_active: boolean;
};

export type PricingBreakdownItem = {
  ruleId: string;
  label: string;
  adjustmentType: string;
  amount: number | null;
  amountMax: number | null;
};

function object(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function number(value: Json | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function matches(answer: Json | undefined, condition: Json) {
  const c = object(condition);
  const expected = c.value;
  switch (c.operator) {
    case "not_equals": return String(answer ?? "") !== String(expected ?? "");
    case "greater_than": return number(answer) > number(expected);
    case "greater_than_or_equal": return number(answer) >= number(expected);
    case "less_than": return number(answer) < number(expected);
    case "less_than_or_equal": return number(answer) <= number(expected);
    case "contains": return Array.isArray(answer) ? answer.map(String).includes(String(expected)) : String(answer ?? "").includes(String(expected ?? ""));
    case "is_not_empty": return answer !== null && answer !== undefined && answer !== "";
    case "is_empty": return answer === null || answer === undefined || answer === "";
    default: return String(answer ?? "") === String(expected ?? "");
  }
}

export function calculatePricing(
  answers: Record<string, Json>,
  config: Json,
  rules: PricingRuleInput[],
) {
  const base = object(config);
  let min = number(base.minimum ?? base.starting_at ?? base.fixed_amount);
  let max = number(base.maximum ?? base.fixed_amount ?? min);
  let price = number(base.fixed_amount ?? base.starting_at ?? min);
  const breakdown: PricingBreakdownItem[] = [];

  for (const rule of rules.filter((item) => item.is_active).sort((a, b) => a.sort_order - b.sort_order)) {
    const condition = object(rule.condition);
    const field = typeof condition.field === "string" ? condition.field : "";
    if (!field || !matches(answers[field], rule.condition)) continue;
    const amount = Number(rule.amount ?? 0);
    const count = Math.max(0, number(answers[field]));
    const before = price;
    if (rule.adjustment_type === "fixed_amount") price += amount;
    if (rule.adjustment_type === "per_item") price += amount * count;
    if (rule.adjustment_type === "percentage") price += price * (amount / 100);
    if (rule.adjustment_type === "minimum") price = Math.max(price, amount);
    if (rule.adjustment_type === "maximum") price = Math.min(price, amount);
    if (rule.adjustment_type === "price_range") {
      min = amount;
      max = Number(rule.amount_max ?? amount);
      price = Math.max(min, Math.min(price || min, max));
    } else {
      const delta = price - before;
      min = min ? min + delta : price;
      max = max ? max + delta : price;
    }
    breakdown.push({ ruleId: rule.id, label: rule.name, adjustmentType: rule.adjustment_type, amount: rule.amount, amountMax: rule.amount_max });
  }

  const rounded = (value: number) => Math.max(0, Math.round(value * 100) / 100);
  return { recommendedMin: rounded(min || price), recommendedMax: rounded(max || price), recommendedPrice: rounded(price), breakdown };
}
