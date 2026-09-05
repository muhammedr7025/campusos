"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { recordMark } from "@/lib/actions/exams";

export function MarksRoster({
  examId,
  maxMarks,
  students,
  existing,
}: {
  examId: string;
  maxMarks: number;
  students: { id: string; name: string; enrollmentNumber: string }[];
  existing: Record<string, number>;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of students) initial[s.id] = existing[s.id] != null ? String(existing[s.id]) : "";
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  async function onSaveAll() {
    setSubmitting(true);
    const entries = students.filter((s) => scores[s.id] !== "" && !Number.isNaN(Number(scores[s.id])));
    const results = await Promise.all(
      entries.map((s) => recordMark({ examId, studentId: s.id, score: Number(scores[s.id]) })),
    );
    setSubmitting(false);
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      toast.error(`${failed.length} score(s) failed to save.`);
    } else {
      toast.success("Marks saved.");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button onClick={onSaveAll} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Check />}
          Save marks
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
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={maxMarks}
                  className="w-20 text-right tabular-nums"
                  value={scores[student.id]}
                  onChange={(e) => setScores((prev) => ({ ...prev, [student.id]: e.target.value }))}
                />
                <span className="text-muted-foreground text-sm">/ {maxMarks}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
