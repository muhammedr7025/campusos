"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { KYC_DOC_LABELS } from "@/lib/admissions/kyc";
import { updateAdmissionSettings } from "@/lib/actions/tenant";

const DOCS = ["ID_PROOF", "PHOTO", "ADDRESS_PROOF", "PREVIOUS_MARKSHEET"] as const;
type Doc = (typeof DOCS)[number];

export function AdmissionSettingsForm({ initialRequired }: { initialRequired: string[] }) {
  const router = useRouter();
  const [required, setRequired] = useState<Set<Doc>>(new Set(DOCS.filter((d) => initialRequired.includes(d))));
  const [saving, setSaving] = useState(false);

  function toggle(doc: Doc, on: boolean) {
    setRequired((prev) => {
      const next = new Set(prev);
      if (on) next.add(doc);
      else next.delete(doc);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const result = await updateAdmissionSettings({ requiredKycDocs: [...required] });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.data.promoted > 0
        ? `Saved. ${result.data.promoted} student${result.data.promoted === 1 ? " is" : "s are"} now fully admitted.`
        : "Admission settings saved.",
    );
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mandatory KYC documents</CardTitle>
        <CardDescription>
          A student stays &ldquo;KYC pending&rdquo; until every ticked document is verified. Unticked documents are still collected
          on the checklist but never block admission. Changes apply to students still awaiting KYC too.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DOCS.map((doc) => (
            <div key={doc} className="flex items-center gap-2">
              <Checkbox id={`kyc-${doc}`} checked={required.has(doc)} onCheckedChange={(v) => toggle(doc, v === true)} />
              <Label htmlFor={`kyc-${doc}`}>{KYC_DOC_LABELS[doc]}</Label>
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={saving} className="w-fit">
          {saving && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
