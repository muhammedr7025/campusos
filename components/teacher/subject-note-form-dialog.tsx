"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { subjectNoteSchema, type SubjectNoteInput } from "@/lib/validators/notes";
import { createSubjectNote } from "@/lib/actions/notes";

const KIND_OPTIONS = [
  { value: "CLASS_NOTES", label: "Class notes" },
  { value: "WORKSHEET", label: "Worksheet" },
  { value: "REFERENCE", label: "Reference" },
  { value: "RECORDED_SESSION", label: "Recorded session" },
] as const;

type CourseOption = { id: string; name: string };
type SubjectOption = { id: string; name: string; courseId: string };

export function SubjectNoteFormDialog({ courses, subjects }: { courses: CourseOption[]; subjects: SubjectOption[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectNoteInput>({
    resolver: zodResolver(subjectNoteSchema),
    defaultValues: { courseId: "", subjectId: "", title: "", kind: "CLASS_NOTES", text: "", pages: undefined },
  });

  const selectedCourseId = watch("courseId");
  const availableSubjects = useMemo(() => subjects.filter((s) => s.courseId === selectedCourseId), [subjects, selectedCourseId]);

  const [file, setFile] = useState<File | null>(null);

  async function onSubmit(values: SubjectNoteInput) {
    // FormData so the PDF rides along with the fields in one request.
    const payload = new FormData();
    payload.set("courseId", values.courseId);
    payload.set("subjectId", values.subjectId);
    payload.set("title", values.title);
    payload.set("kind", values.kind);
    payload.set("text", values.text ?? "");
    payload.set("pages", values.pages != null ? String(values.pages) : "");
    if (file) payload.set("file", file);

    const result = await createSubjectNote(payload);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(file ? "Notes published with attachment." : "Notes published.");
    reset();
    setFile(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={courses.length === 0}>
          <Plus /> Publish notes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish subject notes</DialogTitle>
          <DialogDescription>Visible to every fee-clear student in the course.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.courseId}>
              <FieldLabel htmlFor="courseId">Course</FieldLabel>
              <Controller
                control={control}
                name="courseId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="courseId" className="w-full"><SelectValue placeholder="Select a course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.courseId ? [errors.courseId] : undefined} />
            </Field>
            <Field data-invalid={!!errors.subjectId}>
              <FieldLabel htmlFor="subjectId">Subject</FieldLabel>
              <Controller
                control={control}
                name="subjectId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={availableSubjects.length === 0}>
                    <SelectTrigger id="subjectId" className="w-full"><SelectValue placeholder="Select a subject" /></SelectTrigger>
                    <SelectContent>
                      {availableSubjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.subjectId ? [errors.subjectId] : undefined} />
            </Field>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" {...register("title")} />
              <FieldError errors={errors.title ? [errors.title] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="kind">Type</FieldLabel>
              <Controller
                control={control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="kind" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((k) => (<SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pages">Pages (optional)</FieldLabel>
              <Input id="pages" type="number" {...register("pages", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="text">Description</FieldLabel>
              <Textarea id="text" rows={3} {...register("text")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="file">Attachment (optional)</FieldLabel>
              <Input
                id="file"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">
                PDF or image, up to 20 MB. Students with a cleared balance can open it.
              </p>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Publish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
