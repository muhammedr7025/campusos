"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
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
import { updateAssignmentSchema, type UpdateAssignmentInput } from "@/lib/validators/assignments";
import { updateAssignment } from "@/lib/actions/assignments";

export function EditAssignmentDialog({
  assignmentId,
  title,
  description,
  dueDate,
}: {
  assignmentId: string;
  title: string;
  description: string | null;
  dueDate: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateAssignmentInput>({
    resolver: zodResolver(updateAssignmentSchema),
    defaultValues: { title, description: description ?? "", dueDate },
  });

  async function onSubmit(values: UpdateAssignmentInput) {
    const result = await updateAssignment(assignmentId, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Assignment updated.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit assignment</DialogTitle>
          <DialogDescription>Division, subject, and attachment can&apos;t be changed after posting.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" {...register("title")} />
              <FieldError errors={errors.title ? [errors.title] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={3} {...register("description")} />
            </Field>
            <Field data-invalid={!!errors.dueDate}>
              <FieldLabel htmlFor="dueDate">Due date</FieldLabel>
              <Input id="dueDate" type="date" {...register("dueDate")} />
              <FieldError errors={errors.dueDate ? [errors.dueDate] : undefined} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
