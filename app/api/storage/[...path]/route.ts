import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireSession } from "@/lib/rbac/guard";

const ROOT = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path: segments } = await params;
  const [tenantId] = segments;
  if (tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const relative = segments.join("/");
  const resolved = path.resolve(ROOT, relative);
  if (!resolved.startsWith(ROOT)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const buffer = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
