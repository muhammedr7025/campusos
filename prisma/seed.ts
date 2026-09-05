import "dotenv/config";
import { PrismaClient, Role } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = "password123";

const ROLE_SEEDS: { role: Role; name: string; localPart: string }[] = [
  { role: Role.SUPER_ADMIN, name: "Ava Admin", localPart: "admin" },
  { role: Role.FINANCE, name: "Felix Finance", localPart: "finance" },
  { role: Role.COUNSELOR, name: "Cara Counselor", localPart: "counselor" },
  { role: Role.ADMISSION_OFFICER, name: "Adam Admissions", localPart: "admissions" },
  { role: Role.TEACHER, name: "Tara Teacher", localPart: "teacher" },
  { role: Role.STUDENT, name: "Sam Student", localPart: "student" },
  { role: Role.PARENT, name: "Priya Parent", localPart: "parent" },
];

async function seedTenant(config: {
  subdomain: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}) {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: config.subdomain },
    update: {
      name: config.name,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      accentColor: config.accentColor,
    },
    create: {
      subdomain: config.subdomain,
      name: config.name,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      accentColor: config.accentColor,
    },
  });

  const users: Record<string, { id: string }> = {};
  for (const seed of ROLE_SEEDS) {
    const email = `${seed.localPart}@${config.subdomain}.test`;
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { name: seed.name, role: seed.role, passwordHash },
      create: {
        tenantId: tenant.id,
        email,
        name: seed.name,
        role: seed.role,
        passwordHash,
      },
    });
    users[seed.role] = user;
  }

  const batch = await prisma.batch.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "2025-26" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "2025-26",
      startYear: 2025,
      endYear: 2026,
      status: "ACTIVE",
    },
  });

  const course = await prisma.course.upsert({
    where: { batchId_name: { batchId: batch.id, name: "NEET Foundation" } },
    update: {},
    create: {
      tenantId: tenant.id,
      batchId: batch.id,
      name: "NEET Foundation",
      description: "Foundation course for NEET aspirants",
      durationLabel: "12 months",
    },
  });

  const division = await prisma.division.upsert({
    where: { courseId_name: { courseId: course.id, name: "Morning Batch A" } },
    update: {},
    create: {
      tenantId: tenant.id,
      courseId: course.id,
      name: "Morning Batch A",
      capacity: 40,
    },
  });

  for (const subjectName of ["Physics", "Chemistry", "Biology"]) {
    await prisma.subject.upsert({
      where: { courseId_name: { courseId: course.id, name: subjectName } },
      update: {},
      create: { tenantId: tenant.id, courseId: course.id, name: subjectName },
    });
  }

  const feeStructure = await prisma.feeStructure.upsert({
    where: { id: `${tenant.id}-default-fee-structure` },
    update: {},
    create: {
      id: `${tenant.id}-default-fee-structure`,
      tenantId: tenant.id,
      courseId: course.id,
      name: "NEET Foundation — Standard Plan",
      totalAmount: 60000,
      lateFeeType: "FLAT",
      lateFeeValue: 500,
      gracePeriodDays: 7,
      installments: {
        create: [
          { label: "Installment 1", amount: 20000, dueDate: new Date("2025-06-15"), sequence: 1 },
          { label: "Installment 2", amount: 20000, dueDate: new Date("2025-09-15"), sequence: 2 },
          { label: "Installment 3", amount: 20000, dueDate: new Date("2025-12-15"), sequence: 3 },
        ],
      },
    },
  });

  const lead = await prisma.lead.upsert({
    where: { id: `${tenant.id}-demo-lead` },
    update: {},
    create: {
      id: `${tenant.id}-demo-lead`,
      tenantId: tenant.id,
      name: "Riya Sharma",
      phone: "+91-9000000001",
      source: "WALK_IN",
      interestedCourseId: course.id,
      status: "CONVERTED",
      assignedCounselorId: users[Role.COUNSELOR].id,
      followUps: {
        create: [
          {
            tenantId: tenant.id,
            type: "CALL",
            notes: "Initial inquiry call, interested in NEET Foundation.",
            completedAt: new Date("2025-05-01"),
            createdById: users[Role.COUNSELOR].id,
          },
          {
            tenantId: tenant.id,
            type: "VISIT",
            notes: "Campus visit, ready to enroll.",
            completedAt: new Date("2025-05-05"),
            createdById: users[Role.COUNSELOR].id,
          },
        ],
      },
    },
  });

  const student = await prisma.student.upsert({
    where: { tenantId_enrollmentNumber: { tenantId: tenant.id, enrollmentNumber: `${config.subdomain.toUpperCase()}-2025-0001` } },
    update: {},
    create: {
      tenantId: tenant.id,
      convertedFromLeadId: lead.id,
      enrollmentNumber: `${config.subdomain.toUpperCase()}-2025-0001`,
      name: lead.name,
      phone: lead.phone,
      courseId: course.id,
      divisionId: division.id,
      userId: users[Role.STUDENT].id,
      status: "ACTIVE",
      kycDocuments: {
        create: [
          { tenantId: tenant.id, docType: "ID_PROOF", status: "VERIFIED", fileUrl: null, verifiedById: users[Role.ADMISSION_OFFICER].id, verifiedAt: new Date() },
          { tenantId: tenant.id, docType: "PHOTO", status: "VERIFIED", fileUrl: null, verifiedById: users[Role.ADMISSION_OFFICER].id, verifiedAt: new Date() },
          { tenantId: tenant.id, docType: "ADDRESS_PROOF", status: "PENDING", fileUrl: null },
        ],
      },
      enrollments: {
        create: [{ tenantId: tenant.id, divisionId: division.id, recordedById: users[Role.ADMISSION_OFFICER].id }],
      },
    },
  });

  const guardian = await prisma.parentGuardian.upsert({
    where: { userId: users[Role.PARENT].id },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Priya Sharma",
      phone: "+91-9000000002",
      relationship: "Mother",
      userId: users[Role.PARENT].id,
      students: { create: [{ studentId: student.id, isPrimary: true }] },
    },
  });
  void guardian;

  const feePlan = await prisma.feePlan.upsert({
    where: { id: `${tenant.id}-demo-fee-plan` },
    update: {},
    create: {
      id: `${tenant.id}-demo-fee-plan`,
      tenantId: tenant.id,
      studentId: student.id,
      feeStructureId: feeStructure.id,
      totalAmount: feeStructure.totalAmount,
      installments: {
        create: [
          { label: "Installment 1", amount: 20000, dueDate: new Date("2025-06-15"), sequence: 1 },
          { label: "Installment 2", amount: 20000, dueDate: new Date("2025-09-15"), sequence: 2 },
          { label: "Installment 3", amount: 20000, dueDate: new Date("2025-12-15"), sequence: 3 },
        ],
      },
    },
    include: { installments: true },
  });

  const firstInstallment = feePlan.installments[0];
  await prisma.payment.upsert({
    where: { id: `${tenant.id}-demo-payment-1` },
    update: {},
    create: {
      id: `${tenant.id}-demo-payment-1`,
      tenantId: tenant.id,
      studentId: student.id,
      feePlanId: feePlan.id,
      installmentId: firstInstallment.id,
      amount: 20000,
      mode: "UPI",
      paidAt: new Date("2025-06-10"),
      collectedById: users[Role.FINANCE].id,
      note: "Paid via UPI on time.",
    },
  });

  await prisma.timetable.upsert({
    where: { id: `${tenant.id}-demo-timetable-1` },
    update: {},
    create: {
      id: `${tenant.id}-demo-timetable-1`,
      tenantId: tenant.id,
      divisionId: division.id,
      subjectId: (await prisma.subject.findFirstOrThrow({ where: { courseId: course.id, name: "Physics" } })).id,
      teacherId: users[Role.TEACHER].id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      room: "Room 101",
    },
  });

  console.log(`Seeded tenant "${tenant.name}" (${tenant.subdomain}) — login as e.g. admin@${tenant.subdomain}.test / ${DEV_PASSWORD}`);
}

async function main() {
  await seedTenant({
    subdomain: "acme",
    name: "Acme Institute of Sciences",
    primaryColor: "#15584A",
    secondaryColor: "#F4F2ED",
    accentColor: "#C9821A",
  });

  // Nova keeps a deliberately different palette — the only way to prove
  // white-labeling actually works is to see a second tenant that doesn't
  // look like the first one.
  await seedTenant({
    subdomain: "nova",
    name: "Nova Learning Academy",
    primaryColor: "#16a34a",
    secondaryColor: "#f0fdf4",
    accentColor: "#db2777",
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
