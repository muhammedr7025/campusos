import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { STORAGE_ROOT, storageUrl } from "@/lib/storage/paths";
import type { StorageProvider, StorageSaveInput, StorageSaveResult } from "@/lib/storage/types";

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class LocalStorageProvider implements StorageProvider {
  async save({ tenantId, category, buffer, filename }: StorageSaveInput): Promise<StorageSaveResult> {
    const tenantDir = sanitizeSegment(tenantId);
    const categoryDir = sanitizeSegment(category);
    const dir = join(STORAGE_ROOT, tenantDir, categoryDir);
    await mkdir(dir, { recursive: true });

    // Random stored name: the uploader's filename is never trusted as a path,
    // and two students uploading "id.pdf" must not collide.
    const ext = extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const storedName = `${randomUUID()}${ext}`;
    await writeFile(join(dir, storedName), buffer);

    return { url: storageUrl([tenantDir, categoryDir, storedName]) };
  }
}
