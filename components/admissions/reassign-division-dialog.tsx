"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { reassignDivisionSchema, type ReassignDivisionInput } from "@/lib/validators/admissions";
import { reassignStudentDivision } from "@/lib/actions/admissions";

export function ReassignDivisionDialog({
  studentId,
  currentDivisionId,
  divisions,
}: {
  studentId: string;
  currentDivisionId: string | null;
  divisions: { id: string; name: string; studentCount: number; capacity: number | null }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    handleSubmit,
    control,
    register,
    formState: { errors, isSubmitting },
  } = useForm<ReassignDivisionInput>({
    resolver: zodResolver(reassignDivisionSchema),
    defaultValues: { studentId, divisionId: "", reason: "" },
  });

  async function onSubmit(values: ReassignDivisionInput) {
    const result = await reassignStudentDivision(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Student reassigned.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowLeftRight /> Reassign division
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign division</DialogTitle>
          <DialogDescription>Attendance and assignment history stays with the division it happened in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.divisionId}>
              <FieldLabel htmlFor="divisionId">New division</FieldLabel>
              <Controller
                control={control}
                name="divisionId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="divisionId" className="w-full">
                      <SelectValue placeholder="Select a division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions
                        .filter((d) => d.id !== currentDivisionId)
                        .map((d) => {
                          const full = d.capacity != null && d.studentCount >= d.capacity;
                          return (
                            <SelectItem key={d.id} value={d.id} disabled={full}>
                              {d.name} {d.capacity != null ? `(${d.studentCount}/${d.capacity}${full ? " — full" : ""})` : ""}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.divisionId ? [errors.divisionId] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="reason">Reason (optional)</FieldLabel>
              <Textarea id="reason" rows={2} {...register("reason")} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Reassign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
