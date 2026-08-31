"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Copy, CheckCircle2 } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { createUserSchema, type CreateUserInput } from "@/lib/validators/users";
import { createStaffUser } from "@/lib/actions/users";
import { ROLE_LABEL } from "@/components/layout/nav-items";
import { ROLE_VALUES } from "@/lib/constants/roles";

const ASSIGNABLE_ROLES = [
  ROLE_VALUES.SUPER_ADMIN,
  ROLE_VALUES.FINANCE,
  ROLE_VALUES.COUNSELOR,
  ROLE_VALUES.ADMISSION_OFFICER,
  ROLE_VALUES.TEACHER,
];

export function UserFormDialog() {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", phone: "", role: ROLE_VALUES.TEACHER },
  });

  async function onSubmit(values: CreateUserInput) {
    const result = await createStaffUser(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCredentials(result.data);
    router.refresh();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCredentials(null);
      reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="text-primary" /> Account created</DialogTitle>
              <DialogDescription>Share this login — there&apos;s no email delivery configured yet.</DialogDescription>
            </DialogHeader>
            <div className="bg-muted flex items-center justify-between rounded-md p-3 text-sm">
              <div>
                <p className="text-muted-foreground">{credentials.email}</p>
                <p className="text-muted-foreground">Temp password: <span className="font-mono">{credentials.password}</span></p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(`${credentials.email} / ${credentials.password}`);
                  toast.success("Copied.");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add user</DialogTitle>
              <DialogDescription>Creates a staff account for this institute.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FieldGroup>
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" {...register("name")} />
                  <FieldError errors={errors.name ? [errors.name] : undefined} />
                </Field>
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" {...register("email")} />
                  <FieldError errors={errors.email ? [errors.email] : undefined} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">Phone (optional)</FieldLabel>
                  <Input id="phone" {...register("phone")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="role">Role</FieldLabel>
                  <Controller
                    control={control}
                    name="role"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="role" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((r) => (<SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </FieldGroup>
              <DialogFooter className="mt-6">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Create user
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
