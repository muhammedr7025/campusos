import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-1.5 px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">{label}</span>
          {Icon && <Icon className="text-muted-foreground size-4" />}
        </div>
        <div className="font-heading text-[32px] leading-none tabular-nums">{value}</div>
        {sub && <div className="text-muted-foreground text-[12.5px] leading-snug">{sub}</div>}
      </CardContent>
    </Card>
  );
}
