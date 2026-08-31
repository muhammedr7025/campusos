"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { createAssignment } from "@/lib/actions/assignments";

type DivisionOption = { id: string; name: string; courseId: string };
type SubjectOption = { id: string; name: string; courseId: string };

export function AssignmentFormDialog({ divisions, subjects }: { divisions: DivisionOption[]; subjects: SubjectOption[] }) {
  const [open, setOpen] = useState(false);
  const [divisionId, setDivisionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const courseId = divisions.find((d) => d.id === divisionId)?.courseId;
  const availableSubjects = useMemo(() => subjects.filter((s) => s.courseId === courseId), [subjects, courseId]);

  async function onSubmit(formData: FormData) {
    if (!divisionId || !subjectId) {
      toast.error("Choose a division and subject.");
      return;
    }
    formData.set("divisionId", divisionId);
    formData.set("subjectId", subjectId);
    setSubmitting(true);
    const result = await createAssignment(formData);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Assignment posted.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={divisions.length === 0}>
          <Plus /> New assignment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create assignment</DialogTitle>
          <DialogDescription>Posted to every active student in the division.</DialogDescription>
        </DialogHeader>
        <form action={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="divisionId">Division</FieldLabel>
              <Select value={divisionId} onValueChange={(v) => { setDivisionId(v); setSubjectId(""); }}>
                <SelectTrigger id="divisionId" className="w-full"><SelectValue placeholder="Select a division" /></SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="subjectId">Subject</FieldLabel>
              <Select value={subjectId} onValueChange={setSubjectId} disabled={availableSubjects.length === 0}>
                <SelectTrigger id="subjectId" className="w-full"><SelectValue placeholder="Select a subject" /></SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" name="title" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" name="description" rows={3} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dueDate">Due date</FieldLabel>
              <Input id="dueDate" name="dueDate" type="date" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="attachment">Attachment (optional)</FieldLabel>
              <Input id="attachment" name="attachment" type="file" />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Post assignment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
