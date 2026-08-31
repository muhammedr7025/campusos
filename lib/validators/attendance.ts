import { z } from "zod";

export const markAttendanceSchema = z.object({
  divisionId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().min(1),
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      }),
    )
    .min(1),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const ATTENDANCE_ALERT_THRESHOLD = 75;
