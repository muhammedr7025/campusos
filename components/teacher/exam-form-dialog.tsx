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
import { examSchema, type ExamInput } from "@/lib/validators/exams";
import { createExam } from "@/lib/actions/exams";

type DivisionOption = { id: string; name: string; courseId: string };
type SubjectOption = { id: string; name: string; courseId: string };

export function ExamFormDialog({ divisions, subjects }: { divisions: DivisionOption[]; subjects: SubjectOption[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExamInput>({
    resolver: zodResolver(examSchema),
    defaultValues: { divisionId: "", subjectId: "", name: "", date: "", time: "", maxMarks: 100, syllabus: "" },
  });

  const selectedDivisionId = watch("divisionId");
  const courseId = divisions.find((d) => d.id === selectedDivisionId)?.courseId;
  const availableSubjects = useMemo(() => subjects.filter((s) => s.courseId === courseId), [subjects, courseId]);

  async function onSubmit(values: ExamInput) {
    const result = await createExam(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Exam scheduled.");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={divisions.length === 0}>
          <Plus /> Schedule exam
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule exam</DialogTitle>
          <DialogDescription>Creates the marks sheet for this division.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Exam name</FieldLabel>
              <Input id="name" placeholder="Monthly test 3" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <Field data-invalid={!!errors.divisionId}>
              <FieldLabel htmlFor="divisionId">Division</FieldLabel>
              <Controller
                control={control}
                name="divisionId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="divisionId" className="w-full"><SelectValue placeholder="Select a division" /></SelectTrigger>
                    <SelectContent>
                      {divisions.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.divisionId ? [errors.divisionId] : undefined} />
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
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.date}>
                <FieldLabel htmlFor="date">Date</FieldLabel>
                <Input id="date" type="date" {...register("date")} />
                <FieldError errors={errors.date ? [errors.date] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="time">Start time</FieldLabel>
                <Input id="time" type="time" {...register("time")} />
              </Field>
            </div>
            <Field data-invalid={!!errors.maxMarks}>
              <FieldLabel htmlFor="maxMarks">Max marks</FieldLabel>
              <Input id="maxMarks" type="number" {...register("maxMarks", { valueAsNumber: true })} />
              <FieldError errors={errors.maxMarks ? [errors.maxMarks] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="syllabus">Portion / syllabus</FieldLabel>
              <Textarea id="syllabus" rows={2} {...register("syllabus")} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
