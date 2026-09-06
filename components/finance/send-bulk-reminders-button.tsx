"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendBulkOverdueReminders } from "@/lib/actions/finance";

export function SendBulkRemindersButton() {
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function onSend() {
    setSending(true);
    const result = await sendBulkOverdueReminders();
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.count === 0) {
      toast.info("Nothing overdue right now.");
      return;
    }
    toast.success(`${result.data.count} overdue reminder${result.data.count === 1 ? "" : "s"} queued.`);
    router.refresh();
  }

  return (
    <Button onClick={onSend} disabled={sending}>
      {sending ? <Loader2 className="animate-spin" /> : <Megaphone />}
      Send all overdue reminders
    </Button>
  );
}
