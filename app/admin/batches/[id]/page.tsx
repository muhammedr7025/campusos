import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { BatchFormDialog } from "@/components/admin/batches/batch-form-dialog";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const { id } = await params;

  const batch = await prisma.batch.findFirst({
    where: { id, tenantId },
    include: {
      courses: { include: { _count: { select: { divisions: true, students: true } } }, orderBy: { name: "asc" } },
    },
  });
  if (!batch) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/admin/batches" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back to batches
      </Link>

      <PageHeader
        crumb="Academics"
        title={batch.name}
        description={<>{batch.startYear}–{batch.endYear} · <Badge variant="secondary">{batch.status}</Badge></>}
        actions={<BatchFormDialog batch={{ id: batch.id, name: batch.name, startYear: batch.startYear, endYear: batch.endYear }} />}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Courses</h2>
        {batch.courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="No courses under this batch yet" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {batch.courses.map((course) => (
              <Link key={course.id} href={`/admin/courses/${course.id}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <p className="font-medium">{course.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {course._count.divisions} division{course._count.divisions === 1 ? "" : "s"} · {course._count.students} student{course._count.students === 1 ? "" : "s"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
