import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runScheduledNotifications } from "@/lib/notifications/scheduled";

/**
 * Runs the time-based reminders for every institute. Call it from a real
 * scheduler (cron, a platform job) with `Authorization: Bearer $CRON_SECRET`;
 * the in-app opportunistic run covers the gap when nothing calls it.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://campusos.example/api/cron/reminders
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenants = await prisma.tenant.findMany({ select: { id: true, subdomain: true } });
  const results: Record<string, unknown> = {};
  for (const tenant of tenants) {
    try {
      results[tenant.subdomain] = await runScheduledNotifications(tenant.id);
    } catch (error) {
      console.error(`[cron] reminders failed for ${tenant.subdomain}`, error);
      results[tenant.subdomain] = { error: "failed" };
    }
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}

export const GET = POST;
