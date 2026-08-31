"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Trash2 } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel, FieldError, FieldSeparator } from "@/components/ui/field";
import { feeStructureSchema, type FeeStructureInput } from "@/lib/validators/finance";
import { createFeeStructure, updateFeeStructure } from "@/lib/actions/finance";

type EditingFeeStructure = {
  id: string;
  courseId: string;
  name: string;
  gracePeriodDays: number;
  lateFeeType?: string | null;
  lateFeeValue?: number | null;
  installments: { label: string; amount: number; dueDate: string }[];
};

export function FeeStructureFormDialog({
  courses,
  structure,
}: {
  courses: { id: string; name: string }[];
  structure?: EditingFeeStructure;
}) {
  const isEdit = !!structure;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FeeStructureInput>({
    resolver: zodResolver(feeStructureSchema),
    defaultValues: structure
      ? {
          courseId: structure.courseId,
          name: structure.name,
          gracePeriodDays: structure.gracePeriodDays,
          lateFeeType: (structure.lateFeeType as "FLAT" | "PERCENT" | undefined) ?? "FLAT",
          lateFeeValue: structure.lateFeeValue ?? 0,
          installments: structure.installments,
        }
      : {
          courseId: "",
          name: "",
          gracePeriodDays: 7,
          lateFeeType: "FLAT",
          lateFeeValue: 0,
          installments: [{ label: "Installment 1", amount: 0, dueDate: "" }],
        },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "installments" });

  async function onSubmit(values: FeeStructureInput) {
    const result = isEdit ? await updateFeeStructure(structure.id, values) : await createFeeStructure(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? `Fee structure "${values.name}" updated.` : `Fee structure "${values.name}" created.`);
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
            <Plus /> New fee structure
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit fee structure" : "Create fee structure"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Changes only apply to new fee plans generated after saving." : "Applies to every student admitted into this course."}
          </DialogDescription>
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
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.courseId ? [errors.courseId] : undefined} />
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" placeholder="Standard Plan" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>

            <FieldSeparator>Installments</FieldSeparator>

            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <Field className="flex-1">
                  <FieldLabel htmlFor={`installments.${index}.label`}>Label</FieldLabel>
                  <Input {...register(`installments.${index}.label` as const)} />
                </Field>
                <Field className="w-28">
                  <FieldLabel htmlFor={`installments.${index}.amount`}>Amount</FieldLabel>
                  <Input
                    type="number"
                    {...register(`installments.${index}.amount` as const, { valueAsNumber: true })}
                  />
                </Field>
                <Field className="w-40">
                  <FieldLabel htmlFor={`installments.${index}.dueDate`}>Due date</FieldLabel>
                  <Input type="date" {...register(`installments.${index}.dueDate` as const)} />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  aria-label="Remove installment"
                >
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </div>
            ))}
            {errors.installments?.message && <p className="text-destructive text-sm">{errors.installments.message}</p>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => append({ label: `Installment ${fields.length + 1}`, amount: 0, dueDate: "" })}
            >
              <Plus /> Add installment
            </Button>

            <FieldSeparator>Late fee (optional)</FieldSeparator>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="lateFeeValue">Amount</FieldLabel>
                <Input type="number" {...register("lateFeeValue", { valueAsNumber: true })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gracePeriodDays">Grace period (days)</FieldLabel>
                <Input type="number" {...register("gracePeriodDays", { valueAsNumber: true })} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Create fee structure"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
