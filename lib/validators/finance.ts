import { z } from "zod";

export const feeStructureSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  name: z.string().min(2, "Name is required"),
  lateFeeType: z.enum(["FLAT", "PERCENT"]).optional(),
  lateFeeValue: z.number().min(0).optional(),
  gracePeriodDays: z.number().int().min(0),
  installments: z
    .array(
      z.object({
        label: z.string().min(1, "Label is required"),
        amount: z.number().positive("Amount must be greater than 0"),
        dueDate: z.string().min(1, "Due date is required"),
      }),
    )
    .min(1, "Add at least one installment"),
});

export const paymentSchema = z.object({
  studentId: z.string().min(1),
  feePlanId: z.string().min(1),
  installmentId: z.string().optional(),
  amount: z.number().positive("Amount must be greater than 0"),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  paidAt: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});

export const paymentCorrectionSchema = z.object({
  paymentId: z.string().min(1),
  correctedAmount: z.number(),
  note: z.string().min(2, "Explain the correction"),
});

export const feePlanOverrideSchema = z.object({
  studentId: z.string().min(1),
  totalAmount: z.number().positive(),
  overrideReason: z.string().min(2, "A reason is required for overrides"),
  installments: z
    .array(
      z.object({
        label: z.string().min(1),
        amount: z.number().positive(),
        dueDate: z.string().min(1),
      }),
    )
    .min(1),
});

export type FeeStructureInput = z.infer<typeof feeStructureSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type PaymentCorrectionInput = z.infer<typeof paymentCorrectionSchema>;
export type FeePlanOverrideInput = z.infer<typeof feePlanOverrideSchema>;
