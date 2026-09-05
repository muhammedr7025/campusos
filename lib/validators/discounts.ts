import { z } from "zod";

export const discountRequestSchema = z.object({
  studentId: z.string().min(1),
  kind: z.enum(["Scholarship", "Sibling discount", "Hardship waiver", "Early-payment discount"]),
  amount: z.number().positive(),
  reason: z.string().min(2, "A reason is required for the audit trail"),
});

export type DiscountRequestInput = z.infer<typeof discountRequestSchema>;
