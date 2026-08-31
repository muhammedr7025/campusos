"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { uploadKycDocument, setKycStatus } from "@/lib/actions/admissions";
import type { KycDocType, KycStatus } from "@/generated/prisma/client";

const DOC_LABEL: Record<KycDocType, string> = {
  ID_PROOF: "ID proof",
  PREVIOUS_MARKSHEET: "Previous marksheet",
  PHOTO: "Photo",
  ADDRESS_PROOF: "Address proof",
  OTHER: "Other",
};

const STATUS_VARIANT: Record<KycStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "secondary",
  SUBMITTED: "outline",
  VERIFIED: "default",
  REJECTED: "destructive",
};

export type KycDocRow = {
  id: string;
  docType: KycDocType;
  status: KycStatus;
  fileUrl: string | null;
};

function DocRow({ studentId, doc, canVerify }: { studentId: string; doc: KycDocRow; canVerify: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.set("studentId", studentId);
    formData.set("kycDocumentId", doc.id);
    formData.set("file", file);
    const result = await uploadKycDocument(formData);
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${DOC_LABEL[doc.docType]} uploaded.`);
    router.refresh();
  }

  async function onVerify(status: "VERIFIED" | "REJECTED") {
    setVerifying(true);
    const result = await setKycStatus({ kycDocumentId: doc.id, status });
    setVerifying(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${DOC_LABEL[doc.docType]} ${status === "VERIFIED" ? "verified" : "rejected"}.`);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <FileText className="text-muted-foreground size-5" />
          <div>
            <p className="font-medium">{DOC_LABEL[doc.docType]}</p>
            {doc.fileUrl && (
              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">
                View uploaded file
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[doc.status]}>{doc.status}</Badge>
          <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} accept="image/*,.pdf" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {doc.fileUrl ? "Replace" : "Upload"}
          </Button>
          {canVerify && doc.status !== "PENDING" && doc.status !== "VERIFIED" && (
            <Button variant="outline" size="sm" onClick={() => onVerify("VERIFIED")} disabled={verifying}>
              <CheckCircle2 /> Verify
            </Button>
          )}
          {canVerify && doc.status === "SUBMITTED" && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onVerify("REJECTED")} disabled={verifying}>
              <XCircle /> Reject
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function KycChecklist({ studentId, docs, canVerify }: { studentId: string; docs: KycDocRow[]; canVerify: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {docs.map((doc) => (
        <DocRow key={doc.id} studentId={studentId} doc={doc} canVerify={canVerify} />
      ))}
    </div>
  );
}
