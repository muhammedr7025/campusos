"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { timetableSchema, type TimetableInput, DAY_LABELS } from "@/lib/validators/timetable";
import { createTimetableEntry, updateTimetableEntry } from "@/lib/actions/timetable";

type DivisionOption = { id: string; name: string; courseId: string };
type SubjectOption = { id: string; name: string; courseId: string };
type EditingEntry = TimetableInput & { id: string };

export function TimetableFormDialog({
  divisions,
  subjects,
  teachers,
  entry,
}: {
  divisions: DivisionOption[];
  subjects: SubjectOption[];
  teachers: { id: string; name: string }[];
  entry?: EditingEntry;
}) {
  const isEdit = !!entry;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TimetableInput>({
    resolver: zodResolver(timetableSchema),
    defaultValues: entry ?? { divisionId: "", subjectId: "", teacherId: "", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", room: "" },
  });

  const selectedDivisionId = watch("divisionId");
  const courseId = divisions.find((d) => d.id === selectedDivisionId)?.courseId;
  const availableSubjects = useMemo(() => subjects.filter((s) => s.courseId === courseId), [subjects, courseId]);

  async function onSubmit(values: TimetableInput) {
    const result = isEdit ? await updateTimetableEntry(entry.id, values) : await createTimetableEntry(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Timetable entry updated." : "Timetable entry created.");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label="Edit slot">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button disabled={divisions.length === 0 || teachers.length === 0}>
            <Plus /> New slot
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit timetable slot" : "Add timetable slot"}</DialogTitle>
          <DialogDescription>Double-bookings for a teacher are blocked automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
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

            <Field data-invalid={!!errors.teacherId}>
              <FieldLabel htmlFor="teacherId">Teacher</FieldLabel>
              <Controller
                control={control}
                name="teacherId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="teacherId" className="w-full"><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.teacherId ? [errors.teacherId] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="dayOfWeek">Day</FieldLabel>
              <Controller
                control={control}
                name="dayOfWeek"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger id="dayOfWeek" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAY_LABELS.map((label, idx) => (<SelectItem key={label} value={String(idx)}>{label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.startTime}>
                <FieldLabel htmlFor="startTime">Start</FieldLabel>
                <Input id="startTime" type="time" {...register("startTime")} />
                <FieldError errors={errors.startTime ? [errors.startTime] : undefined} />
              </Field>
              <Field data-invalid={!!errors.endTime}>
                <FieldLabel htmlFor="endTime">End</FieldLabel>
                <Input id="endTime" type="time" {...register("endTime")} />
                <FieldError errors={errors.endTime ? [errors.endTime] : undefined} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="room">Room (optional)</FieldLabel>
              <Input id="room" {...register("room")} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Add slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
