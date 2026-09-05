"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendFeeReminder } from "@/lib/actions/finance";

export function SendReminderButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function onSend() {
    setSending(true);
    const result = await sendFeeReminder(studentId);
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Reminder sent for ${studentName}.`);
    router.refresh();
  }

  return (
    <Button size="sm" onClick={onSend} disabled={sending}>
      {sending ? <Loader2 className="animate-spin" /> : <Megaphone />}
      Send reminder
    </Button>
  );
}
