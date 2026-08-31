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
import { DivisionFormDialog } from "@/components/admin/divisions/division-form-dialog";

export default async function DivisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const { id } = await params;

  const division = await prisma.division.findFirst({
    where: { id, tenantId },
    include: {
      course: true,
      students: { orderBy: { name: "asc" } },
    },
  });
  if (!division) notFound();

  const courses = await prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/admin/divisions" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back to divisions
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{division.name}</h1>
          <p className="text-muted-foreground text-sm">
            {division.course.name} · {division.students.length}
            {division.capacity != null ? ` / ${division.capacity}` : ""} students
          </p>
        </div>
        <DivisionFormDialog
          courses={courses}
          division={{ id: division.id, courseId: division.courseId, name: division.name, capacity: division.capacity }}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Enrolled students</h2>
        {division.students.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students enrolled yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {division.students.map((student) => (
              <Link key={student.id} href={`/admissions/students/${student.id}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-muted-foreground text-sm">{student.enrollmentNumber}</p>
                    </div>
                    <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>{student.status}</Badge>
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
