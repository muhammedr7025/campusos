"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { changeLeadStage } from "@/lib/actions/leads";
import { LEAD_STATUS_LABEL } from "@/components/crm/lead-status-badge";

const EDITABLE_STAGES = ["NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "READY"] as const;

export function StageSelect({ leadId, status }: { leadId: string; status: string }) {
  const router = useRouter();

  if (!EDITABLE_STAGES.includes(status as (typeof EDITABLE_STAGES)[number])) {
    return null;
  }

  async function onChange(value: string) {
    const result = await changeLeadStage({ leadId, status: value });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Select value={status} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EDITABLE_STAGES.map((stage) => (
          <SelectItem key={stage} value={stage}>
            {LEAD_STATUS_LABEL[stage]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
