"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { gradeSubmission } from "@/lib/actions/assignments";

export function GradeSubmissionDialog({
  submissionId,
  studentName,
  submissionText,
  fileUrl,
  initialGrade,
  initialFeedback,
}: {
  submissionId: string;
  studentName: string;
  submissionText: string | null;
  fileUrl: string | null;
  initialGrade: string | null;
  initialFeedback: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState(initialGrade ?? "");
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit() {
    setSubmitting(true);
    const result = await gradeSubmission({ submissionId, grade, feedback });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Grade saved.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil /> Grade
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grade · {studentName}</DialogTitle>
          <DialogDescription>Visible to the student and parent once saved.</DialogDescription>
        </DialogHeader>
        {(submissionText || fileUrl) && (
          <div className="bg-muted rounded-md p-3 text-sm">
            {submissionText && <p>{submissionText}</p>}
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1 hover:underline">
                <FileText className="size-3.5" /> View submitted file
              </a>
            )}
          </div>
        )}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="grade">Grade</FieldLabel>
            <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A / 8/10 / Pass" />
          </Field>
          <Field>
            <FieldLabel htmlFor="feedback">Feedback</FieldLabel>
            <Textarea id="feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter className="mt-4">
          <Button onClick={onSubmit} disabled={submitting || grade.trim().length === 0}>
            {submitting && <Loader2 className="animate-spin" />}
            Save grade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
