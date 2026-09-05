import { z } from "zod";

export const subjectNoteSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  subjectId: z.string().min(1, "Subject is required"),
  title: z.string().min(2, "Title is required"),
  kind: z.enum(["CLASS_NOTES", "WORKSHEET", "REFERENCE", "RECORDED_SESSION"]),
  text: z.string().optional(),
  pages: z.number().int().min(0).optional(),
});

export type SubjectNoteInput = z.infer<typeof subjectNoteSchema>;
