"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { batchSchema, type BatchInput } from "@/lib/validators/academic";
import { createBatch, updateBatch } from "@/lib/actions/academic";

type EditingBatch = { id: string; name: string; startYear: number; endYear: number };

export function BatchFormDialog({ batch }: { batch?: EditingBatch }) {
  const isEdit = !!batch;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BatchInput>({
    resolver: zodResolver(batchSchema),
    defaultValues: batch ?? { name: "", startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1 },
  });

  async function onSubmit(values: BatchInput) {
    const result = isEdit ? await updateBatch(batch.id, values) : await createBatch(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? `Batch "${values.name}" updated.` : `Batch "${values.name}" created.`);
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label="Edit batch">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus /> New batch
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit batch" : "Create batch"}</DialogTitle>
          <DialogDescription>An academic year cohort, e.g. &ldquo;2025-26&rdquo;.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" placeholder="2025-26" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.startYear}>
                <FieldLabel htmlFor="startYear">Start year</FieldLabel>
                <Input id="startYear" type="number" {...register("startYear", { valueAsNumber: true })} />
                <FieldError errors={errors.startYear ? [errors.startYear] : undefined} />
              </Field>
              <Field data-invalid={!!errors.endYear}>
                <FieldLabel htmlFor="endYear">End year</FieldLabel>
                <Input id="endYear" type="number" {...register("endYear", { valueAsNumber: true })} />
                <FieldError errors={errors.endYear ? [errors.endYear] : undefined} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Create batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
