/** Display names for the checklist, shared by the tracker and the detail view. */
export const KYC_DOC_LABELS: Record<string, string> = {
  ID_PROOF: "ID proof",
  PHOTO: "Photo",
  ADDRESS_PROOF: "Address proof",
  PREVIOUS_MARKSHEET: "Previous marksheet",
  OTHER: "Other",
};

type KycDocLike = { docType: string; required: boolean; status: string };

export type KycProgress = {
  verified: number;
  total: number;
  /** Required documents not yet verified, as display names. */
  missing: string[];
  isComplete: boolean;
};

/**
 * How far a student's KYC has got. Only a *verified* document counts —
 * submitted-but-unchecked and rejected both still need someone to act, and a
 * student can't be fully admitted while a mandatory document is outstanding.
 * Optional documents never block completeness.
 */
export function kycProgress(docs: KycDocLike[]): KycProgress {
  const verified = docs.filter((d) => d.status === "VERIFIED").length;
  const missing = docs
    .filter((d) => d.required && d.status !== "VERIFIED")
    .map((d) => KYC_DOC_LABELS[d.docType] ?? d.docType);

  return { verified, total: docs.length, missing, isComplete: missing.length === 0 };
}
