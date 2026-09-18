"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
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
import { guardianProfileSchema, type GuardianProfileInput } from "@/lib/validators/admissions";
import { updateGuardian } from "@/lib/actions/admissions";

type EditingGuardian = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  relationship?: string | null;
};

export function EditGuardianDialog({ guardian }: { guardian: EditingGuardian }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GuardianProfileInput>({
    resolver: zodResolver(guardianProfileSchema),
    defaultValues: {
      name: guardian.name,
      phone: guardian.phone,
      email: guardian.email ?? "",
      relationship: guardian.relationship ?? "",
    },
  });

  async function onSubmit(values: GuardianProfileInput) {
    const result = await updateGuardian(guardian.id, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Guardian updated.");
    for (const note of result.data.notes) toast.message(note);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6" aria-label={`Edit guardian ${guardian.name}`}>
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit guardian</DialogTitle>
          <DialogDescription>Their parent-portal account keeps in step with these details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="guardian-name">Name</FieldLabel>
              <Input id="guardian-name" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="guardian-phone">Phone</FieldLabel>
                <Input id="guardian-phone" {...register("phone")} />
                <FieldError errors={errors.phone ? [errors.phone] : undefined} />
              </Field>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="guardian-email">Email</FieldLabel>
                <Input id="guardian-email" type="email" {...register("email")} />
                <FieldError errors={errors.email ? [errors.email] : undefined} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="guardian-relationship">Relationship</FieldLabel>
              <Input id="guardian-relationship" placeholder="Mother / Father / Guardian" {...register("relationship")} />
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
