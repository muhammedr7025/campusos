export type StorageSaveInput = {
  tenantId: string;
  category: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
};

export type StorageSaveResult = {
  url: string;
};

/**
 * Provider-agnostic file storage. Local filesystem (under public/uploads) is
 * the only real implementation for V1 — swap in S3/R2 later by implementing
 * this interface and registering it in lib/storage/index.ts. Call sites
 * never change.
 */
export interface StorageProvider {
  save(input: StorageSaveInput): Promise<StorageSaveResult>;
}
