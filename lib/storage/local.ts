import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageProvider, StorageSaveInput, StorageSaveResult } from "@/lib/storage/types";

const UPLOAD_ROOT = join(process.cwd(), "public", "uploads");

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class LocalStorageProvider implements StorageProvider {
  async save({ tenantId, category, buffer, filename }: StorageSaveInput): Promise<StorageSaveResult> {
    const tenantDir = sanitizeSegment(tenantId);
    const categoryDir = sanitizeSegment(category);
    const dir = join(UPLOAD_ROOT, tenantDir, categoryDir);
    await mkdir(dir, { recursive: true });

    const ext = extname(filename);
    const storedName = `${randomUUID()}${ext}`;
    await writeFile(join(dir, storedName), buffer);

    return { url: `/uploads/${tenantDir}/${categoryDir}/${storedName}` };
  }
}
