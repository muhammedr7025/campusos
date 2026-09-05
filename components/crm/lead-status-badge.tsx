import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@/generated/prisma/client";

const LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  FOLLOW_UP: "Follow-up",
  READY: "Ready",
  CONVERTED: "Converted",
  LOST: "Lost",
};

const VARIANT: Record<LeadStatus, "default" | "secondary" | "outline" | "destructive"> = {
  NEW: "secondary",
  CONTACTED: "outline",
  INTERESTED: "default",
  FOLLOW_UP: "outline",
  READY: "default",
  CONVERTED: "default",
  LOST: "destructive",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}

export const LEAD_STATUS_LABEL = LABEL;
