"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { markAttendance } from "@/lib/actions/attendance";
import type { AttendanceStatus } from "@/generated/prisma/client";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "P" },
  { value: "ABSENT", label: "A" },
  { value: "LATE", label: "L" },
  { value: "EXCUSED", label: "E" },
];

export function AttendanceRoster({
  divisionId,
  subjectId,
  date,
  students,
  existing,
}: {
  divisionId: string;
  subjectId: string;
  date: string;
  students: { id: string; name: string; enrollmentNumber: string }[];
  existing: Record<string, AttendanceStatus>;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    for (const s of students) initial[s.id] = existing[s.id] ?? "PRESENT";
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  function markAllPresent() {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of students) next[s.id] = "PRESENT";
    setStatuses(next);
  }

  async function onSubmit() {
    setSubmitting(true);
    const result = await markAttendance({
      divisionId,
      subjectId,
      date,
      entries: students.map((s) => ({ studentId: s.id, status: statuses[s.id] })),
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Attendance saved.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={markAllPresent}>
          <Users /> Mark all present
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Check />}
          Save attendance
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {students.map((student) => (
          <Card key={student.id}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">{student.name}</p>
                <p className="text-muted-foreground text-xs">{student.enrollmentNumber}</p>
              </div>
              <ToggleGroup
                type="single"
                value={statuses[student.id]}
                onValueChange={(value) => {
                  if (value) setStatuses((prev) => ({ ...prev, [student.id]: value as AttendanceStatus }));
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <ToggleGroupItem key={opt.value} value={opt.value} className="h-10 w-10" aria-label={opt.value}>
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
