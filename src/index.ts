/**
 * mostlydb - MongoDB-style queries over unstorage backends
 *
 * Provides:
 * - createStorage wrapper that patches getAll from driver onto storage
 * - MostlyDB: MongoDB-style queries over any storage backend
 *
 * Usage:
 * ```ts
 * import { createStorage, MostlyDB } from "mostlydb"
 *
 * const driver = createMyDriver()  // Any unstorage-compatible driver
 * const storage = createStorage({ driver })  // storage.getAll is available!
 * const db = MostlyDB<Item>(storage, "items:")  // auto-detects getAll
 * ```
 */

// Export createStorage wrapper (patches getAll from driver)
export { createStorage, prefixStorage } from "./create-storage.ts"
export type { StorageWithGetAll, DriverWithGetAll } from "./create-storage.ts"

// Export MostlyDB wrapper
export { MostlyDB, StorageWriteError } from "./mostlydb.ts"
export type {
  MostlyDB as IMostlyDB,
  Cursor,
  MostlyDBOptions,
  MostlyDBDocument,
  InsertOneResult,
  UpdateResult,
  DeleteResult,
  UpdateFilter,
  UpdateOperator
} from "./mostlydb.ts"

// Re-export Unstorage types for convenience
export type { Storage, Driver } from "unstorage"
