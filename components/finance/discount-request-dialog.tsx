"use client";

import { useState } from "react";
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
import { discountRequestSchema, type DiscountRequestInput } from "@/lib/validators/discounts";
import { requestDiscount } from "@/lib/actions/discounts";

const KIND_OPTIONS = ["Scholarship", "Sibling discount", "Hardship waiver", "Early-payment discount"] as const;

export function DiscountRequestDialog({ students }: { students: { id: string; name: string; enrollmentNumber: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DiscountRequestInput>({
    resolver: zodResolver(discountRequestSchema),
    defaultValues: { studentId: "", kind: "Scholarship", amount: 0, reason: "" },
  });

  async function onSubmit(values: DiscountRequestInput) {
    const result = await requestDiscount(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Discount request submitted for approval.");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={students.length === 0}>
          <Plus /> Request discount
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request discount</DialogTitle>
          <DialogDescription>Only a Super Admin can approve — this reduces the fee structure, never the balance directly.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.studentId}>
              <FieldLabel htmlFor="studentId">Student</FieldLabel>
              <Controller
                control={control}
                name="studentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="studentId" className="w-full"><SelectValue placeholder="Select a student" /></SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name} · {s.enrollmentNumber}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.studentId ? [errors.studentId] : undefined} />
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
                      {KIND_OPTIONS.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="amount">Amount (₹)</FieldLabel>
              <Input id="amount" type="number" {...register("amount", { valueAsNumber: true })} />
              <FieldError errors={errors.amount ? [errors.amount] : undefined} />
            </Field>
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Textarea id="reason" rows={2} {...register("reason")} />
              <FieldError errors={errors.reason ? [errors.reason] : undefined} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
