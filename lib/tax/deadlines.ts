import type { Json } from "@/types/database";

export const US_JURISDICTIONS = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;

export type JurisdictionCode = (typeof US_JURISDICTIONS)[number][0];

const NO_GENERAL_INDIVIDUAL_INCOME_TAX = new Set<JurisdictionCode>([
  "AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY",
]);

type DeadlineItem = {
  authority: "IRS" | "state";
  jurisdiction: string;
  filingDate: string | null;
  paymentDate: string | null;
  extensionDate: string | null;
  extensionIsAutomatic: boolean;
  ruleStatus: "calculated" | "review_required" | "not_applicable";
  source: string;
  note?: string;
};

export type DeadlineSchedule = {
  calculatedAt: string;
  taxYear: number;
  returnType: string | null;
  fiscalYearEnd: string | null;
  items: DeadlineItem[];
  warnings: string[];
};

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

function nthWeekday(year: number, month: number, weekday: number, nth: number) {
  const date = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(1 + offset + (nth - 1) * 7);
  return date;
}

function observed(date: Date) {
  const day = date.getUTCDay();
  if (day === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (day === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function filingHolidays(year: number) {
  const holidays = [
    observed(new Date(Date.UTC(year, 0, 1))),
    nthWeekday(year, 0, 1, 3),
    nthWeekday(year, 1, 1, 3),
    observed(new Date(Date.UTC(year, 3, 16))), // D.C. Emancipation Day
    nthWeekday(year, 4, 1, 4),
    observed(new Date(Date.UTC(year, 5, 19))),
    observed(new Date(Date.UTC(year, 6, 4))),
    nthWeekday(year, 8, 1, 1),
    nthWeekday(year, 9, 1, 2),
    observed(new Date(Date.UTC(year, 10, 11))),
    nthWeekday(year, 10, 4, 4),
    observed(new Date(Date.UTC(year, 11, 25))),
  ];
  return new Set(holidays.map(iso));
}

export function nextBusinessDay(date: Date) {
  const holidays = filingHolidays(date.getUTCFullYear());
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || holidays.has(iso(date))) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

function calendarDate(year: number, month: number, day: number) {
  return iso(nextBusinessDay(new Date(Date.UTC(year, month - 1, day))));
}

function monthAfter(date: Date, months: number, day = 15) {
  return iso(nextBusinessDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, day))));
}

function federalDates(taxYear: number, returnType: string | null, fiscalYearEnd?: string | null) {
  const yearEnd = fiscalYearEnd ? new Date(`${fiscalYearEnd}T00:00:00Z`) : new Date(Date.UTC(taxYear, 11, 31));
  if (Number.isNaN(yearEnd.valueOf())) return null;

  switch (returnType) {
    case "1040":
    case "state_individual":
    case "709": {
      const filingDate = monthAfter(yearEnd, 4);
      return { filingDate, paymentDate: filingDate, extensionDate: monthAfter(yearEnd, 10) };
    }
    case "1065":
    case "1120-S": {
      const filingDate = monthAfter(yearEnd, 3);
      return { filingDate, paymentDate: filingDate, extensionDate: monthAfter(yearEnd, 9) };
    }
    case "1120": {
      const filingDate = monthAfter(yearEnd, 4);
      return { filingDate, paymentDate: filingDate, extensionDate: monthAfter(yearEnd, 10) };
    }
    case "1041": {
      const filingDate = monthAfter(yearEnd, 4);
      return { filingDate, paymentDate: filingDate, extensionDate: monthAfter(yearEnd, 9, 30) };
    }
    case "990": {
      const filingDate = monthAfter(yearEnd, 5);
      return { filingDate, paymentDate: filingDate, extensionDate: monthAfter(yearEnd, 11) };
    }
    case "940": {
      const filingDate = calendarDate(taxYear + 1, 1, 31);
      return { filingDate, paymentDate: filingDate, extensionDate: null };
    }
    default:
      return null;
  }
}

const DIFFERENT_INDIVIDUAL_DATES: Partial<Record<JurisdictionCode, [number, number, number, number]>> = {
  DE: [4, 30, 10, 15],
  HI: [4, 20, 10, 20],
  IA: [4, 30, 10, 31],
  LA: [5, 15, 11, 15],
  VA: [5, 1, 11, 1],
};

function stateIndividualDates(taxYear: number, code: JurisdictionCode) {
  const rule = DIFFERENT_INDIVIDUAL_DATES[code] ?? [4, 15, 10, 15];
  const [filingMonth, filingDay, extensionMonth, extensionDay] = rule;
  const filingDate = calendarDate(taxYear + 1, filingMonth, filingDay);
  return {
    filingDate,
    paymentDate: filingDate,
    extensionDate: calendarDate(taxYear + 1, extensionMonth, extensionDay),
  };
}

export function calculateEngagementDeadlines(input: {
  taxYear: number;
  returnType?: string | null;
  fiscalYearEnd?: string | null;
  federalRequired: boolean;
  jurisdictions: JurisdictionCode[];
}): DeadlineSchedule {
  const items: DeadlineItem[] = [];
  const warnings: string[] = [];
  const federal = federalDates(input.taxYear, input.returnType ?? null, input.fiscalYearEnd);

  if (input.federalRequired) {
    if (federal) {
      items.push({
        authority: "IRS",
        jurisdiction: "Federal",
        ...federal,
        extensionIsAutomatic: false,
        ruleStatus: "calculated",
        source: "IRS statutory return schedule; adjusted for weekends and federal/D.C. legal holidays",
        note: "An extension to file does not extend the payment deadline.",
      });
    } else {
      items.push({
        authority: "IRS",
        jurisdiction: "Federal",
        filingDate: null,
        paymentDate: null,
        extensionDate: null,
        extensionIsAutomatic: false,
        ruleStatus: "review_required",
        source: "IRS form-specific instructions required",
        note: "This return needs facts not collected by the standard deadline calculator.",
      });
      warnings.push("Federal deadline requires review for the selected return type.");
    }
  }

  for (const code of input.jurisdictions) {
    const name = US_JURISDICTIONS.find(([value]) => value === code)?.[1] ?? code;
    if (["1040", "state_individual"].includes(input.returnType ?? "")) {
      if (NO_GENERAL_INDIVIDUAL_INCOME_TAX.has(code)) {
        items.push({
          authority: "state",
          jurisdiction: `${name} (${code})`,
          filingDate: null,
          paymentDate: null,
          extensionDate: null,
          extensionIsAutomatic: false,
          ruleStatus: "not_applicable",
          source: "State has no general individual income tax return",
          note: "Special-purpose taxes may still apply and require review.",
        });
        continue;
      }
      const dates = stateIndividualDates(input.taxYear, code);
      items.push({
        authority: "state",
        jurisdiction: `${name} (${code})`,
        ...dates,
        extensionIsAutomatic: ["HI", "IA", "LA", "VA"].includes(code),
        ruleStatus: "calculated",
        source: DIFFERENT_INDIVIDUAL_DATES[code]
          ? `${name} individual income tax statutory schedule`
          : "State individual income tax schedule aligned to the federal calendar",
        note: "The original payment deadline remains in effect when filing is extended.",
      });
    } else if (code === "LA" && ["1065", "1120", "1120-S", "1041"].includes(input.returnType ?? "")) {
      const filingDate = calendarDate(input.taxYear + 1, 5, 15);
      items.push({
        authority: "state",
        jurisdiction: "Louisiana (LA)",
        filingDate,
        paymentDate: filingDate,
        extensionDate: calendarDate(input.taxYear + 1, 11, 15),
        extensionIsAutomatic: input.returnType !== "1120",
        ruleStatus: "calculated",
        source: "Louisiana Department of Revenue calendar-year income tax schedule",
        note: input.returnType === "1120"
          ? "A corporate extension depends on a timely federal extension; payment is still due on the original date."
          : "The original payment deadline remains in effect when filing is extended.",
      });
    } else if (code === "HI" && ["1065", "1120", "1120-S", "1041"].includes(input.returnType ?? "")) {
      const filingDate = calendarDate(input.taxYear + 1, 4, 20);
      items.push({
        authority: "state",
        jurisdiction: "Hawaii (HI)",
        filingDate,
        paymentDate: filingDate,
        extensionDate: calendarDate(input.taxYear + 1, 10, 20),
        extensionIsAutomatic: false,
        ruleStatus: "calculated",
        source: "Hawaii Department of Taxation income tax schedule",
      });
    } else {
      items.push({
        authority: "state",
        jurisdiction: `${name} (${code})`,
        filingDate: null,
        paymentDate: null,
        extensionDate: null,
        extensionIsAutomatic: false,
        ruleStatus: "review_required",
        source: "State form-specific instructions required",
        note: "Verexa will not guess a business, fiduciary, payroll, amended, or local deadline.",
      });
      warnings.push(`${code} deadline requires state-specific review for this return type.`);
    }
  }

  return {
    calculatedAt: new Date().toISOString(),
    taxYear: input.taxYear,
    returnType: input.returnType ?? null,
    fiscalYearEnd: input.fiscalYearEnd || null,
    items,
    warnings,
  };
}

export function deadlineScheduleAsJson(schedule: DeadlineSchedule): Json {
  return schedule as unknown as Json;
}

export function primaryDeadlines(schedule: DeadlineSchedule) {
  const calculated = schedule.items.filter((item) => item.ruleStatus === "calculated");
  const federal = calculated.find((item) => item.authority === "IRS");
  const primary = federal ?? calculated[0];
  return {
    filingDate: primary?.filingDate ?? null,
    extensionDate: primary?.extensionDate ?? null,
  };
}
