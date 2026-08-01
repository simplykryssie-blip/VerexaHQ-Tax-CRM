import { z } from "zod";

export const contactMethodOptions = ["email", "phone", "sms", "address", "other"] as const;

export const updateContactInfoSchema = z.object({
  phone: z.string().trim().max(40).optional(),
  preferredContactMethod: z.enum(contactMethodOptions),
});
export type UpdateContactInfoInput = z.infer<typeof updateContactInfoSchema>;

export const updateMailingAddressSchema = z.object({
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(60).optional(),
  postalCode: z.string().trim().max(20).optional(),
});
export type UpdateMailingAddressInput = z.infer<typeof updateMailingAddressSchema>;
