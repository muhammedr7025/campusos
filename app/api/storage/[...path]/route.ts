import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { requireSession } from "@/lib/rbac/guard";
import { canReadStoredFile } from "@/lib/storage/access";
import { contentTypeFor, resolveStoredPath, storageUrl, PUBLIC_CATEGORIES } from "@/lib/storage/paths";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const [tenantId, category] = segments;

  const resolved = resolveStoredPath(segments);
  if (!resolved || !tenantId || !category) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const isPublic = PUBLIC_CATEGORIES.includes(category);
  if (!isPublic) {
    const session = await requireSession().catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const allowed = await canReadStoredFile({
      tenantId,
      category,
      url: storageUrl(segments),
      viewer: { id: session.user.id, role: session.user.role },
    });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await readFile(resolved);
    const contentType = contentTypeFor(resolved);
    // An SVG rendered inline runs its scripts on this origin, so it downloads
    // instead; everything else opens in the browser's own viewer.
    const inline = contentType !== "image/svg+xml";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": inline ? "inline" : "attachment",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isPublic ? "public, max-age=3600" : "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
