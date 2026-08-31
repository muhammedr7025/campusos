"use client";

import { useState } from "react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { correctPayment } from "@/lib/actions/finance";

export function CorrectPaymentDialog({ paymentId, currentAmount }: { paymentId: string; currentAmount: number }) {
  const [open, setOpen] = useState(false);
  const [correctedAmount, setCorrectedAmount] = useState(currentAmount);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit() {
    setSubmitting(true);
    const result = await correctPayment({ paymentId, correctedAmount, note });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Correction recorded.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Correct payment">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct payment</DialogTitle>
          <DialogDescription>
            This never overwrites the original entry — it adds a correction row so the ledger stays auditable.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="correctedAmount">Corrected amount (should have been)</FieldLabel>
            <Input
              id="correctedAmount"
              type="number"
              value={correctedAmount}
              onChange={(e) => setCorrectedAmount(Number(e.target.value))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="note">Reason</FieldLabel>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter className="mt-4">
          <Button onClick={onSubmit} disabled={submitting || note.trim().length < 2}>
            {submitting && <Loader2 className="animate-spin" />}
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
