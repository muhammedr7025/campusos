"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTimetableEntry } from "@/lib/actions/timetable";

export function DeleteSlotButton({ id }: { id: string }) {
  const router = useRouter();

  async function onDelete() {
    const result = await deleteTimetableEntry(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Slot removed.");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" aria-label="Remove slot" onClick={onDelete}>
      <Trash2 className="text-destructive size-4" />
    </Button>
  );
}
