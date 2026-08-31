"use server";

import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requireSession } from "@/lib/rbac/guard";
import { Role } from "@/generated/prisma/client";

export type SearchResults = {
  leads: { id: string; name: string; phone: string }[];
  students: { id: string; name: string; enrollmentNumber: string }[];
};

export async function searchDirectory(query: string): Promise<SearchResults> {
  const session = await requireSession();
  const tenantId = await getTenantId();
  if (query.trim().length < 2) return { leads: [], students: [] };

  const canSearchLeads = ([Role.SUPER_ADMIN, Role.COUNSELOR] as Role[]).includes(session.user.role);
  const canSearchStudents = ([Role.SUPER_ADMIN, Role.FINANCE, Role.ADMISSION_OFFICER] as Role[]).includes(session.user.role);

  const [leads, students] = await Promise.all([
    canSearchLeads
      ? prisma.lead.findMany({
          where: { tenantId, name: { contains: query, mode: "insensitive" } },
          select: { id: true, name: true, phone: true },
          take: 5,
        })
      : Promise.resolve([]),
    canSearchStudents
      ? prisma.student.findMany({
          where: { tenantId, name: { contains: query, mode: "insensitive" } },
          select: { id: true, name: true, enrollmentNumber: true },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return { leads, students };
}
