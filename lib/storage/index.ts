import { LocalStorageProvider } from "@/lib/storage/local";
import type { StorageProvider } from "@/lib/storage/types";

// S3/R2: implement StorageProvider and swap the instance below once a
// provider is chosen (PRD's "File storage" note) — call sites never change.
export const storage: StorageProvider = new LocalStorageProvider();

export type { StorageProvider, StorageSaveInput, StorageSaveResult } from "@/lib/storage/types";
