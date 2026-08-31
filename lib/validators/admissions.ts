import { z } from "zod";

export const convertLeadSchema = z.object({
  leadId: z.string().min(1),
  courseId: z.string().min(1, "Course is required"),
  divisionId: z.string().min(1, "Division is required"),
  dob: z.string().optional(),
  address: z.string().optional(),
  guardianName: z.string().min(2, "Guardian name is required"),
  guardianPhone: z.string().min(6, "Guardian phone is required"),
  guardianEmail: z.email().optional().or(z.literal("")),
  guardianRelationship: z.string().optional(),
});

export const kycStatusSchema = z.object({
  kycDocumentId: z.string().min(1),
  status: z.enum(["VERIFIED", "REJECTED"]),
});

export const studentProfileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  email: z.email().optional().or(z.literal("")),
  dob: z.string().optional(),
  address: z.string().optional(),
});

export const reassignDivisionSchema = z.object({
  studentId: z.string().min(1),
  divisionId: z.string().min(1, "Division is required"),
  reason: z.string().optional(),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type ReassignDivisionInput = z.infer<typeof reassignDivisionSchema>;
