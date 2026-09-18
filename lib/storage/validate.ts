/**
 * One place for what may be uploaded. Every upload used to be accepted as-is:
 * any type, any size — including an SVG, which a browser will happily run
 * scripts from when it's served back inline.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const LOGO_TYPES = [...IMAGE_TYPES, "image/x-icon", "image/vnd.microsoft.icon"];
export const PDF_TYPE = "application/pdf";

/** Coursework: what a teacher hands out and a student hands in. */
export const DOCUMENT_TYPES = [
  PDF_TYPE,
  ...IMAGE_TYPES,
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
];

export type UploadRule = { types: string[]; maxBytes: number; describe: string };

export const UPLOAD_RULES = {
  document: { types: DOCUMENT_TYPES, maxBytes: MAX_UPLOAD_BYTES, describe: "a PDF, image, Office document, text file or ZIP" },
  logo: { types: LOGO_TYPES, maxBytes: MAX_IMAGE_BYTES, describe: "a PNG, JPEG, WebP, GIF or ICO image" },
} satisfies Record<string, UploadRule>;

/** One sentence saying why a file is refused, or null if it's fine. */
export function uploadProblem(file: { type: string; size: number }, rule: UploadRule): string | null {
  if (!rule.types.includes(file.type)) return `Attach ${rule.describe}.`;
  if (file.size > rule.maxBytes) return `That file is over the ${Math.round(rule.maxBytes / (1024 * 1024))} MB limit.`;
  return null;
}
