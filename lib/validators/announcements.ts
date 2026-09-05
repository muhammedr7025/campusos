import { z } from "zod";

export const announcementSchema = z.object({
  title: z.string().min(2, "Title is required"),
  body: z.string().min(2, "Message is required"),
  audience: z.enum(["EVERYONE", "PARENTS", "STUDENTS", "TEACHERS"]),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;
