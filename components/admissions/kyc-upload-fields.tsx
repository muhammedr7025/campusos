"use client";

import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { KYC_DOC_LABELS } from "@/lib/admissions/kyc";
import { KYC_ACCEPT, STANDARD_KYC_DOCS, kycFileField, kycFileProblem } from "@/lib/admissions/kyc-files";
import type { KycDocType } from "@/generated/prisma/client";

export type KycUploadState = Partial<Record<KycDocType, File>>;

/**
 * Builds the multipart body an admission action expects: every form field as
 * a string, plus one file per document type that was handed over.
 */
export function buildAdmissionFormData(values: Record<string, string | undefined>, files: KycUploadState): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value ?? "");
  for (const [docType, file] of Object.entries(files) as [KycDocType, File][]) {
    if (file) form.set(kycFileField(docType), file);
  }
  return form;
}

/**
 * The documents PRD §6.4 has the officer collect at the desk — ID proof,
 * photo, address proof, previous marksheet — attached in the same step as
 * the rest of the admission instead of on a separate page afterwards. Each
 * is optional here; whatever isn't handed over stays pending on the tracker.
 */
export function KycUploadFields({
  files,
  onChange,
  disabled,
}: {
  files: KycUploadState;
  onChange: (docType: KycDocType, file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {STANDARD_KYC_DOCS.map((docType) => {
        const id = kycFileField(docType);
        const chosen = files[docType];
        return (
          <Field key={docType}>
            <FieldLabel htmlFor={id}>{KYC_DOC_LABELS[docType]}</FieldLabel>
            {chosen ? (
              <div className="bg-muted flex h-8 items-center justify-between gap-2 rounded-lg px-2.5 text-sm">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="truncate">{chosen.name}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Remove ${KYC_DOC_LABELS[docType]}`}
                  disabled={disabled}
                  onClick={() => onChange(docType, null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Input
                id={id}
                type="file"
                accept={KYC_ACCEPT}
                disabled={disabled}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  const problem = kycFileProblem(file);
                  if (problem) {
                    toast.error(`${KYC_DOC_LABELS[docType]}: ${problem}`);
                    e.target.value = "";
                    return;
                  }
                  onChange(docType, file);
                }}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
