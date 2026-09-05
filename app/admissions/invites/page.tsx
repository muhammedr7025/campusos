import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { InvitesTable, type InviteRow } from "@/components/admissions/invites-table";

export default async function ParentInvitesPage() {
  await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();

  const students = await prisma.student.findMany({
    where: { tenantId, status: { not: "INACTIVE" } },
    select: {
      id: true,
      name: true,
      enrollmentNumber: true,
      guardians: {
        where: { isPrimary: true },
        take: 1,
        include: { guardian: { include: { user: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows: InviteRow[] = students
    .filter((s) => s.guardians[0])
    .map((s) => {
      const g = s.guardians[0].guardian;
      const user = g.user;
      const status: InviteRow["status"] = user?.lastLoginAt ? "Active" : user?.lastInviteSentAt ? "Awaiting first login" : "Not invited";
      return {
        studentId: s.id,
        studentName: s.name,
        enrollmentNumber: s.enrollmentNumber,
        guardianId: g.id,
        guardianName: g.name,
        guardianPhone: g.phone,
        guardianEmail: user?.email ?? null,
        status,
      };
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Admissions"
        title="Parent portal invites"
        description="Parent accounts link through the admission record — siblings share one login."
      />
      <InvitesTable rows={rows} />
    </div>
  );
}
