import type { KycDocType } from "@/generated/prisma/client";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, PDF_TYPE } from "@/lib/storage/validate";

/**
 * The documents every admission opens a checklist row for, in checklist
 * order. Which of them are mandatory is the institute's call
 * (Tenant.requiredKycDocs); the rest are collected but never block.
 */
export const STANDARD_KYC_DOCS: KycDocType[] = ["ID_PROOF", "PHOTO", "ADDRESS_PROOF", "PREVIOUS_MARKSHEET"];

export const MAX_KYC_FILE_BYTES = MAX_UPLOAD_BYTES;
export const KYC_ALLOWED_TYPES = [PDF_TYPE, ...IMAGE_TYPES];
/** For the browser's file picker; mirrors KYC_ALLOWED_TYPES. */
export const KYC_ACCEPT = KYC_ALLOWED_TYPES.join(",");

/** FormData key an admission form uses for one document's file. */
export function kycFileField(docType: KycDocType): string {
  return `kyc_${docType}`;
}

/** One sentence explaining why a file can't be a KYC document, or null if it can. */
export function kycFileProblem(file: { type: string; size: number }): string | null {
  if (!KYC_ALLOWED_TYPES.includes(file.type)) return "KYC documents must be a PDF or an image (PNG, JPEG, WebP, GIF).";
  if (file.size > MAX_KYC_FILE_BYTES) return "That file is over the 20 MB limit.";
  return null;
}
