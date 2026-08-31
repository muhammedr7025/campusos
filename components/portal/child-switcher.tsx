"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PortalStudent } from "@/lib/portal/context";

export function ChildSwitcher({ students, activeStudentId }: { students: PortalStudent[]; activeStudentId: string }) {
  const router = useRouter();

  if (students.length <= 1) return null;

  function onChange(studentId: string) {
    document.cookie = `activeStudentId=${studentId}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <Select value={activeStudentId} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {students.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
