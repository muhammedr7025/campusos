"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { batchSchema, courseSchema, divisionSchema, subjectSchema } from "@/lib/validators/academic";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function createBatch(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();
    const data = batchSchema.parse(input);

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.batch.create({ data: { tenantId, ...data } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Batch",
        entityId: created.id,
        diff: data,
      });
      return created;
    });

    revalidatePath("/admin/batches");
    return { ok: true, data: { id: batch.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateBatch(batchId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();
    const data = batchSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const before = await tx.batch.findFirstOrThrow({ where: { id: batchId, tenantId } });
      await tx.batch.update({ where: { id: batchId }, data });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Batch",
        entityId: batchId,
        diff: { before: { name: before.name, startYear: before.startYear, endYear: before.endYear }, after: data },
      });
    });

    revalidatePath("/admin/batches");
    revalidatePath(`/admin/batches/${batchId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteBatch(batchId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();

    const batch = await prisma.batch.findFirstOrThrow({
      where: { id: batchId, tenantId },
      include: { _count: { select: { courses: true } } },
    });

    if (batch._count.courses > 0) {
      return { ok: false, error: "Can't delete a batch with courses under it — archive it instead." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.batch.delete({ where: { id: batchId } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Batch",
        entityId: batchId,
        diff: { name: batch.name },
      });
    });

    revalidatePath("/admin/batches");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function setBatchStatus(batchId: string, status: "UPCOMING" | "ACTIVE" | "ARCHIVED"): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();

    await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findFirstOrThrow({ where: { id: batchId, tenantId } });
      await tx.batch.update({ where: { id: batchId }, data: { status } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE_STATUS",
        entityType: "Batch",
        entityId: batchId,
        diff: { from: batch.status, to: status },
      });
    });

    revalidatePath("/admin/batches");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function createCourse(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();
    const data = courseSchema.parse(input);

    await prisma.batch.findFirstOrThrow({ where: { id: data.batchId, tenantId } });

    const course = await prisma.$transaction(async (tx) => {
      const created = await tx.course.create({ data: { tenantId, ...data } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Course",
        entityId: created.id,
        diff: data,
      });
      return created;
    });

    revalidatePath("/admin/courses");
    return { ok: true, data: { id: course.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCourse(courseId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();
    const data = courseSchema.parse(input);

    await prisma.batch.findFirstOrThrow({ where: { id: data.batchId, tenantId } });

    await prisma.$transaction(async (tx) => {
      const before = await tx.course.findFirstOrThrow({ where: { id: courseId, tenantId } });
      await tx.course.update({ where: { id: courseId }, data });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Course",
        entityId: courseId,
        diff: { before: { name: before.name, batchId: before.batchId }, after: data },
      });
    });

    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteCourse(courseId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();

    const course = await prisma.course.findFirstOrThrow({
      where: { id: courseId, tenantId },
      include: { _count: { select: { students: true, divisions: true } } },
    });

    if (course._count.students > 0 || course._count.divisions > 0) {
      return { ok: false, error: "Can't delete a course with active divisions or enrolled students." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.course.delete({ where: { id: courseId } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Course",
        entityId: courseId,
        diff: { name: course.name },
      });
    });

    revalidatePath("/admin/courses");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function createDivision(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();
    const data = divisionSchema.parse(input);

    await prisma.course.findFirstOrThrow({ where: { id: data.courseId, tenantId } });

    const division = await prisma.$transaction(async (tx) => {
      const created = await tx.division.create({ data: { tenantId, ...data } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Division",
        entityId: created.id,
        diff: data,
      });
      return created;
    });

    revalidatePath("/admin/divisions");
    return { ok: true, data: { id: division.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateDivision(divisionId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();
    const data = divisionSchema.parse(input);

    await prisma.course.findFirstOrThrow({ where: { id: data.courseId, tenantId } });

    await prisma.$transaction(async (tx) => {
      const before = await tx.division.findFirstOrThrow({ where: { id: divisionId, tenantId } });
      await tx.division.update({ where: { id: divisionId }, data });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Division",
        entityId: divisionId,
        diff: { before: { name: before.name, capacity: before.capacity }, after: data },
      });
    });

    revalidatePath("/admin/divisions");
    revalidatePath(`/admin/divisions/${divisionId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteDivision(divisionId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();

    const division = await prisma.division.findFirstOrThrow({
      where: { id: divisionId, tenantId },
      include: { _count: { select: { students: true } } },
    });

    if (division._count.students > 0) {
      return { ok: false, error: "Can't delete a division with enrolled students." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.division.delete({ where: { id: divisionId } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Division",
        entityId: divisionId,
        diff: { name: division.name },
      });
    });

    revalidatePath("/admin/divisions");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function createSubject(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();
    const data = subjectSchema.parse(input);

    await prisma.course.findFirstOrThrow({ where: { id: data.courseId, tenantId } });

    const subject = await prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({ data: { tenantId, ...data } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Subject",
        entityId: created.id,
        diff: data,
      });
      return created;
    });

    revalidatePath(`/admin/courses/${data.courseId}`);
    return { ok: true, data: { id: subject.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateSubject(subjectId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();
    const data = subjectSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const before = await tx.subject.findFirstOrThrow({ where: { id: subjectId, tenantId } });
      await tx.subject.update({ where: { id: subjectId }, data: { name: data.name } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Subject",
        entityId: subjectId,
        diff: { before: before.name, after: data.name },
      });
    });

    revalidatePath(`/admin/courses/${data.courseId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteSubject(subjectId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("academic:manage");
    const tenantId = await getTenantId();

    const subject = await prisma.subject.findFirstOrThrow({
      where: { id: subjectId, tenantId },
      include: { _count: { select: { timetables: true, attendances: true, assignments: true } } },
    });

    if (subject._count.timetables > 0 || subject._count.attendances > 0 || subject._count.assignments > 0) {
      return { ok: false, error: "Can't delete a subject already used in a timetable, attendance record, or assignment." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.subject.delete({ where: { id: subjectId } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Subject",
        entityId: subjectId,
        diff: { name: subject.name },
      });
    });

    revalidatePath(`/admin/courses/${subject.courseId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
