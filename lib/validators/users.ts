import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email"),
  phone: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "FINANCE", "COUNSELOR", "ADMISSION_OFFICER", "TEACHER"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "FINANCE", "COUNSELOR", "ADMISSION_OFFICER", "TEACHER"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
