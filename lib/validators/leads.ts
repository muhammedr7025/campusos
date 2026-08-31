import { z } from "zod";

export const leadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(6, "Phone is required"),
  email: z.email().optional().or(z.literal("")),
  source: z.enum(["WALK_IN", "PHONE", "WEB", "REFERRAL", "OTHER"]),
  interestedCourseId: z.string().optional(),
  assignedCounselorId: z.string().optional(),
});

export const followUpSchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(["CALL", "WHATSAPP", "VISIT", "EMAIL", "OTHER"]),
  notes: z.string().optional(),
  scheduledAt: z.string().optional(), // next follow-up date, ISO date string
  completedNow: z.boolean(),
});

export const leadStageSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(["NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP"]),
});

export const lostLeadSchema = z.object({
  leadId: z.string().min(1),
  reason: z.string().min(2, "A reason helps track drop-off causes"),
});

export type LeadInput = z.infer<typeof leadSchema>;
export type FollowUpInput = z.infer<typeof followUpSchema>;
export type LostLeadInput = z.infer<typeof lostLeadSchema>;
