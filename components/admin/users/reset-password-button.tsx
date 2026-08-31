"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { resetStaffUserPassword } from "@/lib/actions/users";

export function ResetPasswordButton({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onReset() {
    setSubmitting(true);
    const result = await resetStaffUserPassword(userId);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPassword(result.data.password);
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setPassword(null); }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Reset password">
          <KeyRound className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {password ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>New password generated</AlertDialogTitle>
              <AlertDialogDescription>Share this with {email} — it won&apos;t be shown again.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="bg-muted flex items-center justify-between rounded-md p-3 text-sm">
              <span className="font-mono">{password}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(password);
                  toast.success("Copied.");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Done</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset password for {email}?</AlertDialogTitle>
              <AlertDialogDescription>Generates a new temporary password and invalidates the old one.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button onClick={onReset} disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Reset password
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
