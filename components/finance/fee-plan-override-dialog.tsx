"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Percent, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { feePlanOverrideSchema, type FeePlanOverrideInput } from "@/lib/validators/finance";
import { createFeePlanOverride } from "@/lib/actions/finance";

export function FeePlanOverrideDialog({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FeePlanOverrideInput>({
    resolver: zodResolver(feePlanOverrideSchema),
    defaultValues: {
      studentId,
      totalAmount: 0,
      overrideReason: "",
      installments: [{ label: "Installment 1", amount: 0, dueDate: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "installments" });

  async function onSubmit(values: FeePlanOverrideInput) {
    const totalAmount = values.installments.reduce((sum, i) => sum + i.amount, 0);
    const result = await createFeePlanOverride({ ...values, totalAmount });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Custom fee plan created.");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Percent /> Custom plan / discount
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create custom fee plan</DialogTitle>
          <DialogDescription>
            Replaces the course&apos;s default plan for this student — use for discounts, scholarships, or one-off arrangements. Logged with your name as approver.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.overrideReason}>
              <FieldLabel htmlFor="overrideReason">Reason</FieldLabel>
              <Textarea id="overrideReason" rows={2} placeholder="20% sibling discount, approved by director…" {...register("overrideReason")} />
              <FieldError errors={errors.overrideReason ? [errors.overrideReason] : undefined} />
            </Field>

            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <Field className="flex-1">
                  <FieldLabel>Label</FieldLabel>
                  <Input {...register(`installments.${index}.label` as const)} />
                </Field>
                <Field className="w-28">
                  <FieldLabel>Amount</FieldLabel>
                  <Input type="number" {...register(`installments.${index}.amount` as const, { valueAsNumber: true })} />
                </Field>
                <Field className="w-40">
                  <FieldLabel>Due date</FieldLabel>
                  <Input type="date" {...register(`installments.${index}.dueDate` as const)} />
                </Field>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => append({ label: `Installment ${fields.length + 1}`, amount: 0, dueDate: "" })}
            >
              <Plus /> Add installment
            </Button>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save custom plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
