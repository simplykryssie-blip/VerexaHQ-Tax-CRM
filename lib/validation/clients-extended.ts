import { z } from "zod";

export const filingStatusOptions = ["single", "mfj", "mfs", "hoh", "qss"] as const;
export const accountTypeOptions = ["checking", "savings"] as const;
export const incomeTypeOptions = ["w2", "1099", "business", "rental", "investment", "retirement", "other"] as const;
export const businessEntityTypeOptions = ["sole_prop", "scorp", "ccorp", "partnership", "llc"] as const;

// Personal Info Tab
export const personalInfoSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(120),
  middleName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  suffix: z.string().trim().max(20).optional(),
  ssn: z.string().trim().max(11).optional(),
  itin: z.string().trim().max(11).optional(),
  dateOfBirth: z.string().date().optional(),
  filingStatus: z.enum(filingStatusOptions).optional(),
  mobilePhone: z.string().trim().max(20).optional(),
  homePhone: z.string().trim().max(20).optional(),
  workPhone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional(),
  occupation: z.string().trim().max(100).optional(),
  drivingLicenseNumber: z.string().trim().max(50).optional(),
  drivingLicenseState: z.string().trim().max(2).optional(),
  drivingLicenseExpiration: z.string().date().optional(),
  preferredContactMethod: z.enum(["email", "phone", "sms", "mail"]).optional(),
  preferredLanguage: z.string().trim().max(50).optional(),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

// Spouse Tab
export const spouseInfoSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(120),
  middleName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  suffix: z.string().trim().max(20).optional(),
  ssn: z.string().trim().max(11).optional(),
  itin: z.string().trim().max(11).optional(),
  dateOfBirth: z.string().date().optional(),
  occupation: z.string().trim().max(100).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(20).optional(),
  drivingLicenseNumber: z.string().trim().max(50).optional(),
  drivingLicenseState: z.string().trim().max(2).optional(),
  drivingLicenseExpiration: z.string().date().optional(),
});

export type SpouseInfoInput = z.infer<typeof spouseInfoSchema>;

// Dependent
export const dependentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(120),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  ssn: z.string().trim().max(11).optional(),
  dateOfBirth: z.string().date().optional(),
  relationship: z.string().trim().max(50).optional(),
  monthsLivedWith: z.coerce.number().min(0).max(12).optional(),
  supportPercent: z.coerce.number().min(0).max(100).optional(),
  isStudent: z.boolean().optional(),
  isDisabled: z.boolean().optional(),
});

export type DependentInput = z.infer<typeof dependentSchema>;

// Banking
export const bankingSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required").max(200),
  routingNumber: z.string().trim().regex(/^\d{9}$/, "Routing number must be 9 digits").optional(),
  accountNumber: z.string().trim().max(50).optional(),
  accountType: z.enum(accountTypeOptions).optional(),
  isPrimary: z.boolean().optional(),
});

export type BankingInput = z.infer<typeof bankingSchema>;

// Employment
export const employmentSchema = z.object({
  employerName: z.string().trim().max(200).optional(),
  employerEin: z.string().trim().max(12).optional(),
  employerAddress: z.string().trim().max(500).optional(),
  incomeType: z.enum(incomeTypeOptions).optional(),
  isSelfEmployed: z.boolean().optional(),
  businessEntityType: z.enum(businessEntityTypeOptions).optional(),
  naicsCode: z.string().trim().max(10).optional(),
});

export type EmploymentInput = z.infer<typeof employmentSchema>;

// Tax History
export const taxHistorySchema = z.object({
  taxYear: z.coerce.number().min(1900).max(2100),
  agi: z.coerce.number().optional(),
  refundAmount: z.coerce.number().optional(),
  hasIrsNotices: z.boolean().optional(),
  carryforwardLoss: z.coerce.number().optional(),
  carryforwardCredits: z.coerce.number().optional(),
});

export type TaxHistoryInput = z.infer<typeof taxHistorySchema>;

// Firm/Service Tab
export const firmServiceSchema = z.object({
  assignedPreparerId: z.string().uuid().optional(),
  eroUserId: z.string().uuid().optional(),
  servicePackage: z.string().trim().max(200).optional(),
  referralSource: z.string().trim().max(500).optional(),
  clientSince: z.string().date().optional(),
  status: z.enum(["prospect", "active", "inactive", "archived"]).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type FirmServiceInput = z.infer<typeof firmServiceSchema>;
