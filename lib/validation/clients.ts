import { z } from "zod";

export const clientTypeOptions = ["individual", "business", "household", "organization"] as const;
export const clientStatusOptions = ["lead", "prospect", "active", "inactive", "archived"] as const;

export const createClientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(120),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  clientType: z.enum(clientTypeOptions),
  status: z.enum(clientStatusOptions),
  email: z.union([z.string().trim().email("Enter a valid email address"), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;
