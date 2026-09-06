import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { kycProgress } from "@/lib/admissions/kyc";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";
import { KycTrackerTable, type KycRow } from "@/components/admissions/kyc-tracker-table";

const FILTERS = ["All", "Incomplete", "Complete"] as const;

export default async function KycTrackerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(params.state ?? "") ? params.state! : "All";

  const students = await prisma.student.findMany({
    where: { tenantId },
    include: {
      course: { select: { name: true } },
      division: { select: { name: true } },
      kycDocuments: { select: { docType: true, required: true, status: true } },
      guardians: { where: { isPrimary: true }, take: 1, include: { guardian: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const allRows: KycRow[] = students.map((s) => {
    const progress = kycProgress(s.kycDocuments);
    return {
      id: s.id,
      name: s.name,
      enrollmentNumber: s.enrollmentNumber,
      courseName: s.course.name,
      divisionName: s.division?.name ?? null,
      guardianName: s.guardians[0]?.guardian.name ?? null,
      verified: progress.verified,
      total: progress.total,
      missing: progress.missing,
      isComplete: progress.isComplete,
      status: s.status,
    };
  });

  const rows = allRows.filter((r) => (filter === "All" ? true : filter === "Complete" ? r.isComplete : !r.isComplete));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Admissions"
        title="KYC tracker"
        description="A student can't be marked fully admitted while a mandatory document is missing. Optional documents never block."
      />

      <FilterPills options={[...FILTERS]} active={filter} paramKey="state" />

      <KycTrackerTable rows={rows} />
    </div>
  );
}
