import { z } from "zod";

export const assignOrganizerSchema = z.object({
  engagementId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  dueDate: z.string().optional().or(z.literal("")),
});
export type AssignOrganizerInput = z.infer<typeof assignOrganizerSchema>;

export const rolloverOrganizerSchema = z.object({
  sourceSubmissionId: z.string().uuid(),
  engagementId: z.string().uuid(),
});
export type RolloverOrganizerInput = z.infer<typeof rolloverOrganizerSchema>;

export const sendReminderSchema = z.object({
  submissionId: z.string().uuid(),
  message: z.string().trim().min(1, "Enter a reminder message.").max(2000),
});
export type SendReminderInput = z.infer<typeof sendReminderSchema>;

export const updateCurrentSectionSchema = z.object({
  submissionId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

export const confirmRolledForwardSchema = z.object({
  kind: z.enum(["answer", "household", "entity"]),
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
});

export const createOrganizerTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
});
export type CreateOrganizerTemplateInput = z.infer<typeof createOrganizerTemplateSchema>;
