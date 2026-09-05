"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendGuardianInvite, type GuardianInviteResult } from "@/lib/actions/admissions";

export function SendInviteButton({ guardianId, resend }: { guardianId: string; resend: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GuardianInviteResult | null>(null);

  async function onSend() {
    setLoading(true);
    const res = await sendGuardianInvite(guardianId);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setResult(res.data);
    router.refresh();
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(`${result.email} / ${result.password}`);
    toast.success("Copied to clipboard.");
  }

  return (
    <>
      <Button size="sm" variant={resend ? "outline" : "default"} onClick={onSend} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <Send />}
        {resend ? "Resend invite" : "Send invite"}
      </Button>

      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Portal invite ready</DialogTitle>
            <DialogDescription>
              A new temporary password was generated — hand it off directly, there&apos;s no email/SMS delivery configured yet.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="bg-muted flex items-center justify-between rounded-md p-3 text-sm">
              <div>
                <p className="text-muted-foreground">{result.email}</p>
                <p className="text-muted-foreground">Temp password: <span className="font-mono">{result.password}</span></p>
              </div>
              <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy credentials">
                <Copy className="size-4" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
