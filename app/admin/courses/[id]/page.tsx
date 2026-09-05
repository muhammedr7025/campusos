import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CourseFormDialog } from "@/components/admin/courses/course-form-dialog";
import { SubjectsManager } from "@/components/admin/courses/subjects-manager";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const { id } = await params;

  const course = await prisma.course.findFirst({
    where: { id, tenantId },
    include: {
      batch: true,
      subjects: { orderBy: { name: "asc" } },
      divisions: { include: { _count: { select: { students: true } } }, orderBy: { name: "asc" } },
    },
  });
  if (!course) notFound();

  const batches = await prisma.batch.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { startYear: "desc" } });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <Link href="/admin/courses" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back to courses
      </Link>

      <PageHeader
        crumb="Academics"
        title={course.name}
        description={
          <>
            {course.batch.name} {course.durationLabel ? `· ${course.durationLabel}` : ""}
            {course.description && <span className="mt-1 block max-w-md">{course.description}</span>}
          </>
        }
        actions={
          <CourseFormDialog
            batches={batches}
            course={{ id: course.id, batchId: course.batchId, name: course.name, description: course.description, durationLabel: course.durationLabel }}
          />
        }
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Subjects</h2>
        <SubjectsManager courseId={course.id} subjects={course.subjects} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Divisions</h2>
        {course.divisions.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No divisions yet" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {course.divisions.map((division) => (
              <Link key={division.id} href={`/admin/divisions/${division.id}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center justify-between p-4">
                    <span className="font-medium">{division.name}</span>
                    <Badge variant="secondary">
                      {division._count.students}
                      {division.capacity != null ? ` / ${division.capacity}` : ""}
                    </Badge>
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
