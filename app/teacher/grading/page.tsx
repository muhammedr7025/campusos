import Link from "next/link";
import { FileCheck } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FILTERS = ["Awaiting", "Graded", "All"] as const;

/**
 * Submissions across every assignment, so grading is one queue rather than a
 * hunt through assignments one at a time. Grading itself still happens on the
 * assignment's own page, where the whole class is visible together.
 */
export default async function GradingQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(params.state ?? "") ? params.state! : "Awaiting";

  const isAdmin = session.user.role === Role.SUPER_ADMIN;
  const submissions = await prisma.submission.findMany({
    where: {
      tenantId,
      status: { not: "MISSING" },
      ...(isAdmin ? {} : { assignment: { teacherId: session.user.id } }),
      ...(filter === "Awaiting" ? { grade: null } : filter === "Graded" ? { grade: { not: null } } : {}),
    },
    include: {
      student: { select: { id: true, name: true, enrollmentNumber: true } },
      assignment: {
        select: {
          id: true,
          title: true,
          dueDate: true,
          subject: { select: { name: true } },
          division: { select: { name: true, course: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ submittedAt: "desc" }],
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title="Grading"
        description="Everything submitted across your assignments, newest first."
      />

      <FilterPills options={[...FILTERS]} active={filter} paramKey="state" />

      {submissions.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title={filter === "Awaiting" ? "Nothing waiting to be graded" : "Nothing here"}
          description={filter === "Awaiting" ? "Every submission has a grade against it." : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {submissions.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{s.student.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {s.assignment.title} · {s.assignment.subject.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {s.assignment.division.course.name} · {s.assignment.division.name} ·{" "}
                    {s.submittedAt
                      ? `submitted ${s.submittedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                      : "not submitted"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.grade ? (
                    <Badge variant="secondary">{s.grade}</Badge>
                  ) : (
                    <Badge variant={s.status === "LATE" ? "warning" : "outline"}>
                      {s.status === "LATE" ? "Late" : "Awaiting"}
                    </Badge>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/teacher/assignments/${s.assignment.id}/submissions`}>Grade</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
