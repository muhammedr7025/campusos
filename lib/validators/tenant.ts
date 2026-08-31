import { z } from "zod";

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex color like #2563eb");

export const brandingSchema = z.object({
  name: z.string().min(2, "Name is required"),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: hex,
  secondaryColor: hex,
  accentColor: hex,
});

export type BrandingInput = z.infer<typeof brandingSchema>;
