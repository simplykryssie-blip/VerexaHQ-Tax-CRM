import { z } from "zod";

export const respondToClarificationSchema = z.object({
  submissionId: z.string().uuid(),
  fieldId: z.string().uuid().nullable(),
  comment: z.string().trim().min(3, "Enter a response.").max(2000),
});
export type RespondToClarificationInput = z.infer<typeof respondToClarificationSchema>;
