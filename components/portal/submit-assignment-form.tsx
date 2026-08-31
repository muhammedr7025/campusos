"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { submitAssignment } from "@/lib/actions/assignments";

export function SubmitAssignmentForm({ submissionId, defaultText }: { submissionId: string; defaultText: string | null }) {
  const [text, setText] = useState(defaultText ?? "");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    formData.set("submissionId", submissionId);
    formData.set("text", text);
    setSubmitting(true);
    const result = await submitAssignment(formData);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Submitted.");
    router.push("/portal/assignments");
    router.refresh();
  }

  return (
    <form action={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="text">Your answer</FieldLabel>
          <Textarea id="text" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="file">Attach a file (optional)</FieldLabel>
          <Input id="file" name="file" type="file" />
        </Field>
      </FieldGroup>
      <Button type="submit" className="mt-4 w-full" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <Upload />}
        Submit assignment
      </Button>
    </form>
  );
}
