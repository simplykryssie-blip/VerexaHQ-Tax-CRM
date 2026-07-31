import { z } from "zod";

export const saveAnswerSchema = z.object({
  submissionId: z.string().uuid(),
  fieldId: z.string().uuid(),
  fieldKey: z.string().min(1),
  value: z.unknown(),
});
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

export const householdPersonSchema = z.object({
  submissionId: z.string().uuid(),
  personId: z.string().uuid().optional(),
  firstName: z.string().trim().min(1, "First name is required").max(120),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  dateOfBirth: z.string().optional(),
  ssnLast4: z.string().trim().regex(/^\d{0,4}$/, "Enter up to 4 digits").optional(),
  relationship: z.string().trim().max(120).optional(),
  monthsInHome: z.number().int().min(0).max(12).optional(),
  isStudent: z.boolean().optional(),
  isDisabled: z.boolean().optional(),
  occupation: z.string().trim().max(120).optional(),
});
export type HouseholdPersonInput = z.infer<typeof householdPersonSchema>;

export const repeatableEntitySchema = z.object({
  submissionId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  entityType: z.string().min(1),
  displayName: z.string().trim().max(200).optional(),
  data: z.record(z.string(), z.unknown()),
});
export type RepeatableEntityInput = z.infer<typeof repeatableEntitySchema>;

export const deleteByIdSchema = z.object({
  submissionId: z.string().uuid(),
  id: z.string().uuid(),
});
