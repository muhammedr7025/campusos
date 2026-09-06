import { prisma } from "@/lib/prisma";
import { setTestActor } from "./actor";

/** Wipes every table between tests so each one starts from a known state. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export type Fixture = Awaited<ReturnType<typeof seedFixture>>;

/**
 * A minimal but realistic institute: one batch/course/subject/division, a
 * staff user per role, and a fee structure with three installments. Anything a
 * specific test needs beyond this it creates itself.
 */
export async function seedFixture() {
  const tenant = await prisma.tenant.create({
    data: { name: "Test Institute", subdomain: "test" },
  });

  const mkUser = (role: "SUPER_ADMIN" | "FINANCE" | "COUNSELOR" | "ADMISSION_OFFICER" | "TEACHER", email: string) =>
    prisma.user.create({
      data: { tenantId: tenant.id, email, name: `${role} User`, passwordHash: "x", role },
    });

  const [admin, finance, counselor, admissions, teacher] = await Promise.all([
    mkUser("SUPER_ADMIN", "admin@test.local"),
    mkUser("FINANCE", "finance@test.local"),
    mkUser("COUNSELOR", "counselor@test.local"),
    mkUser("ADMISSION_OFFICER", "admissions@test.local"),
    mkUser("TEACHER", "teacher@test.local"),
  ]);

  const batch = await prisma.batch.create({
    data: { tenantId: tenant.id, name: "2025-26", startYear: 2025, endYear: 2026, status: "ACTIVE" },
  });
  const course = await prisma.course.create({
    data: { tenantId: tenant.id, batchId: batch.id, name: "NEET Foundation", durationLabel: "12 months" },
  });
  const subject = await prisma.subject.create({
    data: { tenantId: tenant.id, courseId: course.id, name: "Physics" },
  });
  const division = await prisma.division.create({
    data: { tenantId: tenant.id, courseId: course.id, name: "Morning A", capacity: 40 },
  });

  const dueBase = new Date("2026-01-15T00:00:00.000Z");
  const feeStructure = await prisma.feeStructure.create({
    data: {
      tenantId: tenant.id,
      courseId: course.id,
      name: "Standard Plan",
      totalAmount: 60000,
      lateFeeType: "FLAT",
      lateFeeValue: 500,
      gracePeriodDays: 7,
      installments: {
        create: [0, 1, 2].map((i) => ({
          label: `Installment ${i + 1}`,
          amount: 20000,
          sequence: i + 1,
          dueDate: new Date(dueBase.getTime() + i * 90 * 86400000),
        })),
      },
    },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });

  setTestActor({ id: admin.id, role: "SUPER_ADMIN", tenantId: tenant.id });

  return { tenant, admin, finance, counselor, admissions, teacher, batch, course, subject, division, feeStructure };
}

/** Creates an enrolled student (no portal user / guardian) for tests that just need a roster row. */
export async function createStudent(
  f: Fixture,
  overrides: Partial<{ name: string; enrollmentNumber: string; status: "KYC_PENDING" | "ACTIVE" | "INACTIVE"; divisionId: string | null }> = {},
) {
  return prisma.student.create({
    data: {
      tenantId: f.tenant.id,
      name: overrides.name ?? "Riya Sharma",
      enrollmentNumber: overrides.enrollmentNumber ?? `T-${Math.random().toString(36).slice(2, 8)}`,
      courseId: f.course.id,
      divisionId: overrides.divisionId === undefined ? f.division.id : overrides.divisionId,
      status: overrides.status ?? "ACTIVE",
    },
  });
}
