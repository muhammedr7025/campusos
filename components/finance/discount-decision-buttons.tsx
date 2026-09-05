"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideDiscount } from "@/lib/actions/discounts";

export function DiscountDecisionButtons({ discountId }: { discountId: string }) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const router = useRouter();

  async function decide(approve: boolean) {
    setPending(approve ? "approve" : "reject");
    const result = await decideDiscount(discountId, approve);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(approve ? "Discount approved — fee plan updated." : "Discount rejected.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" onClick={() => decide(true)} disabled={pending !== null}>
        {pending === "approve" ? <Loader2 className="animate-spin" /> : <Check />}
        Approve
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => decide(false)} disabled={pending !== null}>
        {pending === "reject" ? <Loader2 className="animate-spin" /> : <X />}
        Reject
      </Button>
    </div>
  );
}
