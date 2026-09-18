import { z } from "zod";

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex color like #2563eb");

// Only files this app stored — an arbitrary URL in the logo slot would let
// the branding page point every login screen at an outside image.
const storedAsset = z.string().regex(/^\/api\/storage\/[A-Za-z0-9_\-./]+$/, "Upload the image instead of pasting a link").optional().or(z.literal(""));

export const brandingSchema = z.object({
  name: z.string().min(2, "Name is required"),
  logoUrl: storedAsset,
  faviconUrl: storedAsset,
  primaryColor: hex,
  secondaryColor: hex,
  accentColor: hex,
});

export type BrandingInput = z.infer<typeof brandingSchema>;

export const admissionSettingsSchema = z.object({
  requiredKycDocs: z.array(z.enum(["ID_PROOF", "PHOTO", "ADDRESS_PROOF", "PREVIOUS_MARKSHEET"])),
});

export type AdmissionSettingsInput = z.infer<typeof admissionSettingsSchema>;
