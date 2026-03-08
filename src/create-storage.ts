/**
 * Enhanced createStorage wrapper that patches getAll from driver
 *
 * unstorage's createStorage() doesn't expose driver methods to consumers.
 * This wrapper patches getAll onto the storage instance if the driver supports it.
 */

import {
  createStorage as unstorageCreateStorage,
  prefixStorage as unstoragePrefixStorage,
  type Storage,
  type Driver,
  type StorageValue
} from "unstorage"

/**
 * Driver that optionally supports getAll for bulk loading
 */
export interface DriverWithGetAll extends Driver {
  getAll?: () => Promise<Array<{ key: string; value: unknown }>>
}

/**
 * Extended storage with optional getAll from driver
 */
export interface StorageWithGetAll<
  T extends StorageValue = StorageValue
> extends Storage<T> {
  getAll?: () => Promise<Array<{ key: string; value: T }>>
}

/**
 * Create storage with getAll patched from driver if available
 *
 * @example
 * ```ts
 * const driver = createGmailDraftsStorageDriver(gmail)
 * const storage = createStorage({ driver })
 *
 * // Now storage.getAll is available if driver supports it
 * if (storage.getAll) {
 *   const items = await storage.getAll()
 * }
 * ```
 */
export function createStorage<T extends StorageValue = StorageValue>(opts: {
  driver: DriverWithGetAll
}): StorageWithGetAll<T> {
  const storage = unstorageCreateStorage<T>(opts) as StorageWithGetAll<T>

  // Patch getAll from driver if available
  if (opts.driver.getAll) {
    storage.getAll = opts.driver.getAll.bind(opts.driver) as () => Promise<
      Array<{ key: string; value: T }>
    >
  }

  return storage
}

/**
 * Enhanced prefixStorage that preserves getAll with prefix filtering
 *
 * Unlike unstorage's prefixStorage, this version:
 * - Preserves getAll from the base storage
 * - Filters getAll results to only include keys matching the prefix
 * - Returns keys with prefix stripped (consistent with getKeys behavior)
 */
export function prefixStorage<T extends StorageValue = StorageValue>(
  storage: Storage<T> | StorageWithGetAll<T>,
  prefix: string
): StorageWithGetAll<T> {
  const prefixed = unstoragePrefixStorage(storage, prefix) as StorageWithGetAll<T>

  // Preserve getAll with prefix filtering
  // IMPORTANT: Only wrap getAll if prefix is non-empty - unstorage returns the same
  // storage object for empty prefix, so wrapping would create infinite recursion
  const storageWithGetAll = storage as StorageWithGetAll<T>
  const originalGetAll = storageWithGetAll.getAll
  if (originalGetAll && prefix) {
    prefixed.getAll = async () => {
      const allItems = await originalGetAll()
      return allItems
        .filter(({ key }) => key.startsWith(prefix))
        .map(({ key, value }) => ({ key: key.slice(prefix.length), value }))
    }
  }

  return prefixed
}
