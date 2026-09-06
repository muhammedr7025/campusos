"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setStudentStatus } from "@/lib/actions/admissions";

const OPTIONS = [
  { value: "KYC_PENDING", label: "KYC pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive (alumni)" },
] as const;

export function StudentStatusSelect({ studentId, status }: { studentId: string; status: string }) {
  const router = useRouter();

  async function onChange(value: string) {
    const result = await setStudentStatus(studentId, value);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Status updated.");
    router.refresh();
  }

  return (
    <Select value={status} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-[150px]" aria-label="Student status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
