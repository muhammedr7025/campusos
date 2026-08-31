import { z } from "zod";

export const batchSchema = z.object({
  name: z.string().min(2, "Name is required"),
  startYear: z.number().int().min(2000).max(2100),
  endYear: z.number().int().min(2000).max(2100),
}).refine((data) => data.endYear >= data.startYear, {
  message: "End year must be on or after start year",
  path: ["endYear"],
});

export const courseSchema = z.object({
  batchId: z.string().min(1, "Batch is required"),
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  durationLabel: z.string().optional(),
});

export const divisionSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  name: z.string().min(1, "Name is required"),
  capacity: z.number().int().min(1).max(1000).optional(),
});

export const subjectSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  name: z.string().min(1, "Name is required"),
});

export const reassignDivisionSchema = z.object({
  studentId: z.string().min(1),
  divisionId: z.string().min(1, "Division is required"),
  reason: z.string().optional(),
});

export type BatchInput = z.infer<typeof batchSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type DivisionInput = z.infer<typeof divisionSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type ReassignDivisionInput = z.infer<typeof reassignDivisionSchema>;
