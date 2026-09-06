"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validators/profile";
import { changeOwnPassword } from "@/lib/actions/profile";

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    const result = await changeOwnPassword(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Password changed.");
    reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> Change password</CardTitle>
        <CardDescription>Use a password you don&apos;t use anywhere else.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.currentPassword}>
              <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...register("currentPassword")} />
              <FieldError errors={errors.currentPassword ? [errors.currentPassword] : undefined} />
            </Field>
            <Field data-invalid={!!errors.newPassword}>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <Input id="newPassword" type="password" autoComplete="new-password" {...register("newPassword")} />
              <FieldError errors={errors.newPassword ? [errors.newPassword] : undefined} />
            </Field>
          </FieldGroup>
          <Button type="submit" className="mt-4" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
