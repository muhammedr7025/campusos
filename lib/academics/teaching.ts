import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { BusinessRuleError } from "@/lib/actions/errors";

type Actor = { id: string; role: Role };

/**
 * A teacher's classes are the (division, subject) pairs on their timetable.
 * Marking attendance, posting an assignment or scheduling an exam for anyone
 * else's class isn't theirs to do — and before this check, nothing stopped it.
 * Super Admin sees the whole institute and is exempt.
 */
export async function teachesClass(tenantId: string, teacherId: string, divisionId: string, subjectId: string): Promise<boolean> {
  const slot = await prisma.timetable.findFirst({
    where: { tenantId, teacherId, divisionId, subjectId },
    select: { id: true },
  });
  return slot != null;
}

export async function assertTeaches(tenantId: string, actor: Actor, divisionId: string, subjectId: string): Promise<void> {
  if (actor.role === Role.SUPER_ADMIN) return;
  if (await teachesClass(tenantId, actor.id, divisionId, subjectId)) return;
  throw new BusinessRuleError("That class isn't on your timetable, so you can't act for it.");
}

export type TaughtClass = {
  divisionId: string;
  divisionName: string;
  courseId: string;
  courseName: string;
  subjectId: string;
  subjectName: string;
};

/**
 * The classes an actor may act for, for populating pickers: a teacher's own
 * timetable, or every division × its course's subjects for Super Admin.
 */
export async function listTaughtClasses(tenantId: string, actor: Actor): Promise<TaughtClass[]> {
  if (actor.role === Role.SUPER_ADMIN) {
    const divisions = await prisma.division.findMany({
      where: { tenantId },
      select: { id: true, name: true, course: { select: { id: true, name: true, subjects: { select: { id: true, name: true } } } } },
      orderBy: { name: "asc" },
    });
    return divisions.flatMap((d) =>
      d.course.subjects.map((s) => ({
        divisionId: d.id,
        divisionName: d.name,
        courseId: d.course.id,
        courseName: d.course.name,
        subjectId: s.id,
        subjectName: s.name,
      })),
    );
  }

  const slots = await prisma.timetable.findMany({
    where: { tenantId, teacherId: actor.id },
    select: {
      divisionId: true,
      subjectId: true,
      division: { select: { name: true, course: { select: { id: true, name: true } } } },
      subject: { select: { name: true } },
    },
  });
  const seen = new Map<string, TaughtClass>();
  for (const s of slots) {
    const key = `${s.divisionId}:${s.subjectId}`;
    if (!seen.has(key)) {
      seen.set(key, {
        divisionId: s.divisionId,
        divisionName: s.division.name,
        courseId: s.division.course.id,
        courseName: s.division.course.name,
        subjectId: s.subjectId,
        subjectName: s.subject.name,
      });
    }
  }
  return [...seen.values()];
}
