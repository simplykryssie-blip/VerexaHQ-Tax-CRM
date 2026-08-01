import { z } from "zod";

export const reviewResultOptions = ["pending", "pass", "fail", "needs_clarification", "not_applicable"] as const;

export const requestClarificationSchema = z.object({
  submissionId: z.string().uuid(),
  fieldId: z.string().uuid(),
  comment: z.string().trim().min(3, "Enter a clarification message.").max(2000),
  clientVisible: z.boolean().default(true),
});
export type RequestClarificationInput = z.infer<typeof requestClarificationSchema>;

export const resolveClarificationSchema = z.object({
  commentId: z.string().uuid(),
  resolution: z.string().trim().max(2000).optional(),
});
export type ResolveClarificationInput = z.infer<typeof resolveClarificationSchema>;

export const reviewSectionSchema = z.object({
  submissionId: z.string().uuid(),
  sectionId: z.string().uuid(),
  result: z.enum(reviewResultOptions),
  notes: z.string().trim().max(2000).optional(),
});
export type ReviewSectionInput = z.infer<typeof reviewSectionSchema>;

export const reopenIntakeSchema = z.object({
  submissionId: z.string().uuid(),
  reason: z.string().trim().min(5, "Provide a reason for reopening this intake.").max(1000),
});
export type ReopenIntakeInput = z.infer<typeof reopenIntakeSchema>;
