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
import { paymentSchema, type PaymentInput } from "@/lib/validators/finance";
import { logPayment } from "@/lib/actions/finance";

const MODE_OPTIONS = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;

export function LogPaymentDialog({
  studentId,
  feePlanId,
  installments,
}: {
  studentId: string;
  feePlanId: string;
  installments: { id: string; label: string; amount: number }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      studentId,
      feePlanId,
      installmentId: installments[0]?.id,
      amount: installments[0]?.amount ?? 0,
      mode: "CASH",
      paidAt: new Date().toISOString().slice(0, 10),
      note: "",
    },
  });

  async function onSubmit(values: PaymentInput) {
    const result = await logPayment(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Payment of ₹${values.amount.toLocaleString("en-IN")} logged.`);
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Log payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log payment</DialogTitle>
          <DialogDescription>Recorded with your name as collector — this becomes part of the audit trail.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {installments.length > 0 && (
              <Field>
                <FieldLabel htmlFor="installmentId">Installment</FieldLabel>
                <Controller
                  control={control}
                  name="installmentId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="installmentId" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {installments.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.label} — ₹{i.amount.toLocaleString("en-IN")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.amount}>
                <FieldLabel htmlFor="amount">Amount</FieldLabel>
                <Input id="amount" type="number" {...register("amount", { valueAsNumber: true })} />
                <FieldError errors={errors.amount ? [errors.amount] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="mode">Mode</FieldLabel>
                <Controller
                  control={control}
                  name="mode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="mode" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODE_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <Field data-invalid={!!errors.paidAt}>
              <FieldLabel htmlFor="paidAt">Date</FieldLabel>
              <Input id="paidAt" type="date" {...register("paidAt")} />
              <FieldError errors={errors.paidAt ? [errors.paidAt] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="note">Note (optional)</FieldLabel>
              <Textarea id="note" rows={2} {...register("note")} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Log payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
