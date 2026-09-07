import path from "node:path";

/**
 * The one definition of where local uploads live. The writer
 * (LocalStorageProvider) and the reader (/api/storage) both derive from this
 * — they used to disagree, which is how attachments ended up written to
 * public/uploads and served from an empty ./storage.
 *
 * It deliberately sits outside `public/`: Next only serves what was in
 * public/ at build time, so a file written there at runtime is invisible in
 * production and wiped by the next container rebuild.
 */
export const STORAGE_ROOT = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");

/** Public URL for a stored object. Reads go through the authenticated route. */
export function storageUrl(segments: string[]): string {
  return `/api/storage/${segments.join("/")}`;
}

/**
 * Resolves URL segments to an on-disk path, or null if they escape the root.
 * `path.resolve` collapses `..` before we compare, so traversal attempts land
 * outside STORAGE_ROOT and get rejected here rather than reading /etc/passwd.
 */
export function resolveStoredPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  if (segments.some((s) => s === "" || s.includes("\0"))) return null;
  const resolved = path.resolve(STORAGE_ROOT, segments.join("/"));
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) return null;
  return resolved;
}

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/** Logos render on the signed-out landing and login pages, so they can't need a session. */
export const PUBLIC_CATEGORIES = ["branding"];
