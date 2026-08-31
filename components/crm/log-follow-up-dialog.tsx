"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { followUpSchema, type FollowUpInput } from "@/lib/validators/leads";
import { logFollowUp } from "@/lib/actions/leads";

const TYPE_OPTIONS = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "VISIT", label: "Visit" },
  { value: "EMAIL", label: "Email" },
  { value: "OTHER", label: "Other" },
] as const;

export function LogFollowUpDialog({ leadId, leadName, trigger }: { leadId: string; leadName: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<FollowUpInput>({
    resolver: zodResolver(followUpSchema),
    defaultValues: { leadId, type: "CALL", notes: "", scheduledAt: "", completedNow: true },
  });

  async function onSubmit(values: FollowUpInput) {
    const result = await logFollowUp(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Follow-up logged.");
    reset({ leadId, type: "CALL", notes: "", scheduledAt: "", completedNow: true });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <PhoneCall /> Log follow-up
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log follow-up · {leadName}</DialogTitle>
          <DialogDescription>Add to the timeline and optionally schedule the next touch-point.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="type">Type</FieldLabel>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" rows={3} placeholder="What happened?" {...register("notes")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="scheduledAt">Next follow-up (optional)</FieldLabel>
              <Input id="scheduledAt" type="date" {...register("scheduledAt")} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
