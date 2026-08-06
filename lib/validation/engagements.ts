import { z } from "zod";

// Controlled vocabularies this phase introduces. Kept centralized here (and
// in lib/status.ts for display metadata) rather than hard-coded per
// component, per Part 3's "shared typed constants" requirement.
export const engagementTypeOptions = [
  "individual",
  "business",
  "nonprofit",
  "amended_return",
  "extension_only",
  "tax_planning",
  "notice_resolution",
  "other",
] as const;
export type EngagementTypeOption = (typeof engagementTypeOptions)[number];

export const returnTypeOptions = [
  "1040",
  "1040-X",
  "1065",
  "1120",
  "1120-S",
  "1041",
  "706",
  "709",
  "990",
  "941",
  "940",
  "state_individual",
  "state_business",
  "local",
  "other",
] as const;

export const engagementStatusOptions = [
  "draft",
  "awaiting_client",
  "intake_in_progress",
  "documents_requested",
  "ready_for_preparation",
  "in_preparation",
  "preparer_review",
  "reviewer_review",
  "awaiting_signature",
  "ready_to_file",
  "filed",
  "accepted",
  "rejected",
  "extended",
  "completed",
  "on_hold",
  "cancelled",
  "archived",
] as const;

export const engagementPriorityOptions = ["low", "normal", "high", "urgent"] as const;

export const engagementEfileStatusOptions = [
  "not_started",
  "not_applicable",
  "awaiting_authorization",
  "ready",
  "transmitted",
  "accepted",
  "rejected",
  "corrected",
  "paper_filed",
] as const;

export const engagementPaymentStatusOptions = [
  "not_required",
  "unpaid",
  "partially_paid",
  "paid",
  "payment_plan",
  "refund_transfer",
  "waived",
] as const;

export const dueDateStateOptions = ["overdue", "due_soon_7", "due_soon_30", "no_due_date"] as const;

// Compatibility exports used by the newer engagement screens. Keep these
// aliases tied to the validated vocabularies above so forms and database
// writes cannot drift onto unsupported enum values.
export const RETURN_TYPES = returnTypeOptions;
export const ENGAGEMENT_TYPE_OPTIONS = engagementTypeOptions;
export const ENGAGEMENT_PRIORITIES = engagementPriorityOptions;
export const ENGAGEMENT_TYPE_LABELS: Record<EngagementTypeOption, string> = {
  individual: "Individual return",
  business: "Business return",
  nonprofit: "Nonprofit return",
  amended_return: "Amended return",
  extension_only: "Extension only",
  tax_planning: "Tax planning",
  notice_resolution: "Notice resolution",
  other: "Other",
};
export const ENGAGEMENT_STATUS_LABELS = Object.fromEntries(
  engagementStatusOptions.map((status) => [
    status,
    status.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()),
  ]),
) as Record<(typeof engagementStatusOptions)[number], string>;

export function engagementStatusLabel(status: string) {
  return ENGAGEMENT_STATUS_LABELS[status as keyof typeof ENGAGEMENT_STATUS_LABELS] ?? status.replaceAll("_", " ");
}

const currentYear = new Date().getFullYear();

const moneyField = z
  .union([z.string().trim(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return null;
    const n = typeof value === "string" ? Number(value) : value;
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  })
  .refine((value) => value === null || value >= 0, "Must be zero or greater");

// Live `engagements.priority` enum values (engagement_priority in the DB).
export const engagementPriorityValues = ["Low", "Medium", "High", "Urgent"] as const;

// The live "engagements" table shape (client_id, service_id, workflow_id
// derived from the service's process, current_stage derived from the
// process's first stage, priority as Low/Medium/High/Urgent) has nothing in
// common with the fields below (taxYear, returnType, jurisdiction, etc.),
// which target the dead "tax_engagements" table. createEngagementSchema is
// defined separately, further down, against the live table. The schema
// below remains only for updateEngagementSchema/changeStatusSchema/etc.,
// which still target "tax_engagements" via lib/actions/engagements.ts and
// are out of scope for this pass.
//
// A plain object schema (no refinements) so it can still be reshaped with
// .omit()/.partial()/.extend() below — Zod 4 only allows those on a bare
// ZodObject, not on a schema already wrapped by .refine().
const engagementBaseObjectSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1, "Title is required").max(200),
  taxYear: z.coerce
    .number()
    .int()
    .min(2000, "Tax year must be 2000 or later")
    .max(currentYear + 1, `Tax year must be ${currentYear + 1} or earlier`),
  engagementType: z.enum(engagementTypeOptions),
  returnType: z.enum(returnTypeOptions).optional().or(z.literal("")),
  status: z.enum(engagementStatusOptions).default("draft"),
  priority: z.enum(engagementPriorityOptions).default("normal"),
  preparerUserId: z.string().uuid().optional().or(z.literal("")),
  reviewerUserId: z.string().uuid().optional().or(z.literal("")),
  responsibleStaffUserId: z.string().uuid().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  internalDueDate: z.string().optional().or(z.literal("")),
  jurisdiction: z.string().trim().max(100).optional(),
  federalReturnRequired: z.boolean().default(true),
  stateReturnRequired: z.boolean().default(false),
  localReturnRequired: z.boolean().default(false),
  description: z.string().trim().max(4000).optional(),
  intakeSubmissionId: z.string().uuid().optional().or(z.literal("")),
  documentRequestId: z.string().uuid().optional().or(z.literal("")),
});

function withValidDueDates<T extends z.ZodType<{ dueDate?: string; internalDueDate?: string }>>(schema: T) {
  return schema
    .refine((data) => !data.dueDate || !Number.isNaN(Date.parse(data.dueDate)), {
      message: "Enter a valid due date",
      path: ["dueDate"],
    })
    .refine((data) => !data.internalDueDate || !Number.isNaN(Date.parse(data.internalDueDate)), {
      message: "Enter a valid internal due date",
      path: ["internalDueDate"],
    });
}

// The live "engagements" table's actual create shape: pick a client and a
// service, everything else (workflow_id, current_stage, engagement_number,
// status) is derived server-side in createEngagementAction.
export const createEngagementSchema = z
  .object({
    clientId: z.string().uuid("Select a client"),
    serviceId: z.string().uuid("Select a service"),
    priority: z.enum(engagementPriorityValues).default("Medium"),
    dueDate: z.string().optional().or(z.literal("")),
    internalReference: z.string().trim().max(200).optional(),
  })
  .refine((data) => !data.dueDate || !Number.isNaN(Date.parse(data.dueDate)), {
    message: "Enter a valid due date",
    path: ["dueDate"],
  });
export type CreateEngagementInput = z.infer<typeof createEngagementSchema>;

// Retained for updateEngagementSchema/etc. below, which still target the
// dead "tax_engagements" table shape — out of scope for this pass.
export const legacyCreateEngagementSchema = withValidDueDates(engagementBaseObjectSchema);
export type LegacyCreateEngagementInput = z.infer<typeof legacyCreateEngagementSchema>;

export const updateEngagementSchema = withValidDueDates(
  engagementBaseObjectSchema.omit({ clientId: true }).partial().extend({
    balanceDue: moneyField,
    refundAmount: moneyField,
  }),
);
export type UpdateEngagementInput = z.infer<typeof updateEngagementSchema>;

export const changeStatusSchema = z.object({
  engagementId: z.string().uuid(),
  status: z.enum(engagementStatusOptions),
  override: z.boolean().optional(),
  reason: z.string().trim().max(1000).optional(),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const assignUserSchema = z.object({
  engagementId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
});

export const changeDueDatesSchema = z.object({
  engagementId: z.string().uuid(),
  dueDate: z.string().optional().or(z.literal("")),
  internalDueDate: z.string().optional().or(z.literal("")),
  extensionDueDate: z.string().optional().or(z.literal("")),
});

export const addNoteSchema = z.object({
  engagementId: z.string().uuid(),
  body: z.string().trim().min(1, "Note cannot be empty").max(4000),
  isClientVisible: z.boolean().default(false),
  isPinned: z.boolean().default(false),
});
export type AddNoteInput = z.infer<typeof addNoteSchema>;

export const engagementListFiltersSchema = z.object({
  q: z.string().optional(),
  taxYear: z.coerce.number().int().optional(),
  status: z.enum(engagementStatusOptions).optional(),
  returnType: z.enum(returnTypeOptions).optional(),
  engagementType: z.enum(engagementTypeOptions).optional(),
  preparerUserId: z.string().uuid().optional(),
  reviewerUserId: z.string().uuid().optional(),
  priority: z.enum(engagementPriorityOptions).optional(),
  dueDateState: z.enum(dueDateStateOptions).optional(),
  clientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
});
export type EngagementListFilters = z.infer<typeof engagementListFiltersSchema>;
