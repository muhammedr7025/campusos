import { z } from "zod";

export const assignmentSchema = z.object({
  divisionId: z.string().min(1, "Division is required"),
  subjectId: z.string().min(1, "Subject is required"),
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
});

export const gradeSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  grade: z.string().min(1, "Grade is required"),
  feedback: z.string().optional(),
});

export const submitAssignmentSchema = z.object({
  submissionId: z.string().min(1),
  text: z.string().optional(),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
