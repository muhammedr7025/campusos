import { z } from "zod";

export const examSchema = z.object({
  divisionId: z.string().min(1, "Division is required"),
  subjectId: z.string().min(1, "Subject is required"),
  name: z.string().min(2, "Name is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  maxMarks: z.number().int().positive(),
  syllabus: z.string().optional(),
});

export const recordMarkSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  score: z.number().min(0),
});

export type ExamInput = z.infer<typeof examSchema>;
export type RecordMarkInput = z.infer<typeof recordMarkSchema>;
