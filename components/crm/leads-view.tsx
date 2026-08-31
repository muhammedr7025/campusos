"use client";

import { useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadFormDialog } from "@/components/crm/lead-form-dialog";
import { LeadsKanban } from "@/components/crm/leads-kanban";
import { LeadsTable } from "@/components/crm/leads-table";
import { LeadsFilterBar } from "@/components/crm/leads-filter-bar";
import type { LeadRow } from "@/components/crm/lead-row-types";

export function LeadsView({
  leads,
  courses,
  counselors,
}: {
  leads: LeadRow[];
  courses: { id: string; name: string }[];
  counselors: { id: string; name: string }[];
}) {
  const [view, setView] = useState<"kanban" | "table">("kanban");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <LeadsFilterBar counselors={counselors} courses={courses} />
        <LeadFormDialog courses={courses} />
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")}>
        <TabsList>
          <TabsTrigger value="kanban"><LayoutGrid /> Pipeline</TabsTrigger>
          <TabsTrigger value="table"><Table2 /> Table</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban">
          <LeadsKanban leads={leads} />
        </TabsContent>
        <TabsContent value="table">
          <LeadsTable leads={leads} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
