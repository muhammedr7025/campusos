"use client";

import { useState } from "react";
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
import { divisionSchema, type DivisionInput } from "@/lib/validators/academic";
import { createDivision, updateDivision } from "@/lib/actions/academic";

type EditingDivision = { id: string; courseId: string; name: string; capacity: number | null };

export function DivisionFormDialog({ courses, division }: { courses: { id: string; name: string }[]; division?: EditingDivision }) {
  const isEdit = !!division;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DivisionInput>({
    resolver: zodResolver(divisionSchema),
    defaultValues: division
      ? { courseId: division.courseId, name: division.name, capacity: division.capacity ?? undefined }
      : { courseId: "", name: "" },
  });

  async function onSubmit(values: DivisionInput) {
    const result = isEdit ? await updateDivision(division.id, values) : await createDivision(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? `Division "${values.name}" updated.` : `Division "${values.name}" created.`);
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button disabled={courses.length === 0}>
            <Plus /> New division
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit division" : "Create division"}</DialogTitle>
          <DialogDescription>A section/class-group within a course, e.g. &ldquo;Morning Batch A&rdquo;.</DialogDescription>
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
                    <SelectTrigger id="courseId" className="w-full">
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.courseId ? [errors.courseId] : undefined} />
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" placeholder="Morning Batch A" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <Field data-invalid={!!errors.capacity}>
              <FieldLabel htmlFor="capacity">Capacity</FieldLabel>
              <Input
                id="capacity"
                type="number"
                placeholder="40"
                {...register("capacity", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
              <FieldError errors={errors.capacity ? [errors.capacity] : undefined} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Create division"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
