/**
 * MostlyDB - MongoDB-style queries over unstorage
 *
 * Wraps any unstorage backend with:
 * - In-memory cache for O(n) queries (vs N × HTTP for each query)
 * - MongoDB query syntax via Mingo
 * - External change detection via driver watch()
 * - Bulk loading via storage.getAll() or getKeys+getItems fallback
 * - MongoDB-style write operations (insertOne, updateOne, deleteOne, etc.)
 *
 * Write semantics (all operations):
 * - Cache-first, then persist to backend
 * - Throws StorageWriteError on persist failure (restart required to restore consistency)
 * - set() infers _id from key if missing, throws if _id exists but mismatches
 *
 * Concurrency: "Last Write Wins" - KV backends lack transactions, concurrent
 * updates to the same document result in last write winning.
 */

import { Query, updateOne as mingoUpdateOne, updateMany as mingoUpdateMany } from "mingo"
import type { Modifier } from "mingo/updater"
import { type Storage } from "unstorage"
import { prefixStorage } from "./create-storage.ts"
const createLogger = (name: string) => ({
  debug: (...args: unknown[]) => { if (process.env.DEBUG) console.debug(`[${name}]`, ...args) },
  warn: (...args: unknown[]) => console.warn(`[${name}]`, ...args),
})
import type { StorageWithGetAll } from "./create-storage.ts"

/** MongoDB update operators */
export type UpdateOperator =
  | "$set"
  | "$unset"
  | "$inc"
  | "$push"
  | "$pull"
  | "$addToSet"
  | "$pop"
  | "$rename"

/** MongoDB-style update filter with operators */
export type UpdateFilter<T> = {
  $set?: Partial<T>
  $unset?: Partial<Record<keyof T, "" | true | 1>>
  $inc?: Partial<Record<keyof T, number>>
  $push?: Partial<Record<keyof T, unknown>>
  $pull?: Partial<Record<keyof T, unknown>>
  $addToSet?: Partial<Record<keyof T, unknown>>
  $pop?: Partial<Record<keyof T, 1 | -1>>
  $rename?: Partial<Record<keyof T, string>>
}

const logger = createLogger("@beorn/mostlydb")
const CACHE_SIZE_WARNING = 10000

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MostlyDBOptions {
  // Reserved for future options
}

export interface Cursor<T> {
  sort(spec: Record<string, 1 | -1>): Cursor<T>
  limit(n: number): Cursor<T>
  skip(n: number): Cursor<T>
  toArray(): Promise<T[]>
}

/** MongoDB-style query filter */
type QueryFilter = Record<string, unknown>

/** Result from insertOne operation */
export interface InsertOneResult {
  acknowledged: boolean
  insertedId: string
}

/** Result from updateOne/updateMany operations */
export interface UpdateResult {
  acknowledged: boolean
  matchedCount: number
  modifiedCount: number
}

/** Result from deleteOne/deleteMany operations */
export interface DeleteResult {
  acknowledged: boolean
  deletedCount: number
}

/** Document with required _id field for MostlyDB operations */
export type MostlyDBDocument = { _id: string }

/**
 * Error thrown when backend persistence fails after cache was updated.
 * Indicates cache/backend inconsistency - caller should restart the application.
 */
export class StorageWriteError extends Error {
  public readonly operation: "insert" | "update" | "delete"
  public readonly affectedIds: string[]

  constructor(
    message: string,
    operation: "insert" | "update" | "delete",
    affectedIds: string[],
    cause?: unknown
  ) {
    super(`${message} (restart required to restore consistency)`, { cause })
    this.name = "StorageWriteError"
    this.operation = operation
    this.affectedIds = affectedIds
  }
}

export interface MostlyDB<T extends MostlyDBDocument> extends AsyncDisposable {
  // KV operations
  get(key: string): Promise<T | null>
  set(key: string, value: Omit<T, "_id"> & { _id?: string }): Promise<void>
  del(key: string): Promise<void>
  keys(base?: string): Promise<string[]>

  // Read queries (unchanged)
  find(query?: QueryFilter): Cursor<T>
  findOne(query?: QueryFilter): Promise<T | null>
  count(query?: QueryFilter): Promise<number>

  // Write operations (F326)
  insertOne(doc: Omit<T, "_id"> & { _id?: string }): Promise<InsertOneResult>
  updateOne(filter: QueryFilter, update: UpdateFilter<T>): Promise<UpdateResult>
  updateMany(filter: QueryFilter, update: UpdateFilter<T>): Promise<UpdateResult>
  deleteOne(filter: QueryFilter): Promise<DeleteResult>
  deleteMany(filter: QueryFilter): Promise<DeleteResult>

  [Symbol.asyncDispose](): Promise<void>
}

/**
 * Immutable cursor - each method returns new instance
 */
class MingoCursor<T> implements Cursor<T> {
  constructor(
    private readonly ready: Promise<void>,
    private readonly cache: Map<string, T>,
    private readonly query: QueryFilter,
    private readonly _sort?: Record<string, 1 | -1>,
    private readonly _limit?: number,
    private readonly _skip?: number
  ) {}

  sort(spec: Record<string, 1 | -1>): Cursor<T> {
    return new MingoCursor(
      this.ready,
      this.cache,
      this.query,
      spec,
      this._limit,
      this._skip
    )
  }

  limit(n: number): Cursor<T> {
    return new MingoCursor(this.ready, this.cache, this.query, this._sort, n, this._skip)
  }

  skip(n: number): Cursor<T> {
    return new MingoCursor(this.ready, this.cache, this.query, this._sort, this._limit, n)
  }

  async toArray(): Promise<T[]> {
    await this.ready
    let cursor = new Query(this.query).find([...this.cache.values()])
    if (this._sort) cursor = cursor.sort(this._sort)
    if (this._skip) cursor = cursor.skip(this._skip)
    if (this._limit) cursor = cursor.limit(this._limit)
    return cursor.all() as T[]
  }
}

/**
 * Create a MostlyDB wrapper around an unstorage instance
 *
 * @param kv - Storage instance (use createStorage for getAll support)
 * @param prefix - Key prefix for isolation (e.g., "jobs:")
 * @param _options - Configuration options (reserved for future use)
 * @returns MostlyDB instance with MongoDB-style query API
 *
 * Note: All documents have an _id field. set() infers _id from key if not provided.
 */
export function MostlyDB<T extends MostlyDBDocument>(
  kv: Storage | StorageWithGetAll,
  prefix: string,
  _options: MostlyDBOptions = {}
): MostlyDB<T> {
  const prefixed = prefixStorage(kv, prefix)
  const cache = new Map<string, T>()
  let unwatch: (() => void) | undefined
  let disposed = false
  let loaded = false

  // Queue events that arrive during initial load (fixes race condition)
  const pendingEvents: Array<{ event: "update" | "remove"; key: string }> = []

  // Use getAll from prefixed storage (our prefixStorage preserves and filters getAll)
  const prefixedWithGetAll = prefixed as StorageWithGetAll
  const getAll = prefixedWithGetAll.getAll?.bind(prefixedWithGetAll)

  // Load cache on init
  const ready = (async () => {
    // Start watching BEFORE load to capture changes during initialization
    // watch() may return Promise<Unwatch> or Unwatch
    const watchResult = prefixed.watch?.((event, key) => {
      if (disposed) return
      if (!loaded) {
        // Queue events during load - will be applied after
        pendingEvents.push({ event, key })
        return
      }
      // Normal handling after load complete
      if (event === "update") {
        void (async () => {
          const v = await prefixed.getItem(key)
          if (v) cache.set(key, v as T)
        })()
      } else {
        cache.delete(key)
      }
    })
    // Await if it's a promise, otherwise use directly
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- watchResult is Promise | Unwatch, we await correctly
    unwatch = watchResult instanceof Promise ? await watchResult : watchResult

    if (getAll) {
      // Use efficient bulk loading if available
      // prefixStorage.getAll() already filters by prefix and strips prefix from keys
      logger.debug("Loading cache via getAll", { prefix })
      const items = await getAll()
      for (const { key, value } of items) {
        cache.set(key, value as T)
      }
      logger.debug("Cache loaded via getAll", { prefix, count: cache.size })
    } else {
      // Fallback to getKeys + getItems (2 calls instead of N+1)
      logger.debug("No getAll available, using getKeys+getItems fallback", { prefix })
      const keys = await prefixed.getKeys()
      if (keys.length > 0) {
        const items = await prefixed.getItems(keys.map((key) => ({ key })))
        for (const { key, value } of items) {
          if (value) cache.set(key, value as T)
        }
      }
      logger.debug("Cache loaded via getItems", { prefix, count: cache.size })
    }

    // Apply any events that arrived during load (dedupe: keep last event per key)
    if (pendingEvents.length > 0) {
      logger.debug("Applying queued watch events", {
        prefix,
        count: pendingEvents.length
      })
      const lastEventByKey = new Map(pendingEvents.map((e) => [e.key, e]))
      for (const { event, key } of lastEventByKey.values()) {
        if (event === "update") {
          const value = await prefixed.getItem(key)
          if (value) cache.set(key, value as T)
        } else {
          cache.delete(key)
        }
      }
      pendingEvents.length = 0 // Clear queue
    }
    loaded = true

    // Warn if cache exceeds recommended size
    if (cache.size > CACHE_SIZE_WARNING) {
      logger.warn("Cache size exceeds recommended limit", {
        prefix,
        size: cache.size,
        limit: CACHE_SIZE_WARNING,
        recommendation: "Consider Tier 2 (MongoDB)"
      })
    }
  })()

  return {
    async get(key) {
      await ready
      return cache.get(key) ?? null
    },

    async set(key, value: Omit<T, "_id"> & { _id?: string }) {
      await ready
      // Infer _id from key if missing, throw if mismatched
      if (value._id && value._id !== key) {
        throw new Error(`MostlyDB.set: key "${key}" must equal value._id "${value._id}"`)
      }
      const doc = { ...value, _id: key } as T
      cache.set(key, doc)
      try {
        await prefixed.setItem(key, doc)
      } catch (err) {
        throw new StorageWriteError(
          `Failed to persist set for ${key}`,
          "update",
          [key],
          err
        )
      }
    },

    async del(key) {
      await ready
      cache.delete(key)
      try {
        await prefixed.removeItem(key)
      } catch (err) {
        throw new StorageWriteError(
          `Failed to persist del for ${key}`,
          "delete",
          [key],
          err
        )
      }
    },

    async keys(base) {
      await ready
      return [...cache.keys()].filter((k) => !base || k.startsWith(base))
    },

    find(query) {
      return new MingoCursor(ready, cache, query ?? {}, undefined, undefined, undefined)
    },

    async findOne(query) {
      await ready
      const result = new Query(query ?? {}).find([...cache.values()]).next()
      return (result as T) ?? null
    },

    async count(query) {
      await ready
      return query ? new Query(query).find([...cache.values()]).all().length : cache.size
    },

    // Write operations (F326)

    async insertOne(doc) {
      await ready

      // Generate _id if missing
      const _id = "_id" in doc && doc._id ? (doc._id as string) : crypto.randomUUID()
      const fullDoc = { ...doc, _id } as T

      // Check for duplicate _id
      if (cache.has(_id)) {
        throw new Error(`Duplicate _id: ${_id}`)
      }

      cache.set(_id, fullDoc)
      try {
        await prefixed.setItem(_id, fullDoc)
      } catch (err) {
        throw new StorageWriteError(
          `Failed to persist insertOne for ${_id}`,
          "insert",
          [_id],
          err
        )
      }

      return { acknowledged: true, insertedId: _id }
    },

    async updateOne(filter, update) {
      await ready

      // Use mingo's updateOne directly on cache values (mutates in place)
      // _id immutability is validated by mingo (vendor/mingo build)
      const docs = [...cache.values()]
      const result = mingoUpdateOne(docs, filter, update as Modifier)

      if (result.modifiedCount === 0) {
        return { acknowledged: true, matchedCount: result.matchedCount, modifiedCount: 0 }
      }

      // Get the modified doc using mingo's modifiedIndex (avoids re-query)
      // Note: cache already updated since docs array contains same object refs
      if (result.modifiedIndex === undefined) {
        throw new Error(
          "mingo updateOne did not return modifiedIndex - check vendor build"
        )
      }
      const modified = docs[result.modifiedIndex] as T

      // Persist to backend (cache already updated)
      try {
        await prefixed.setItem(modified._id, modified)
      } catch (err) {
        throw new StorageWriteError(
          `Failed to persist updateOne for ${modified._id}`,
          "update",
          [modified._id],
          err
        )
      }

      return { acknowledged: true, ...result }
    },

    async updateMany(filter, update) {
      await ready

      // Use mingo's updateMany directly on cache values (mutates in place)
      // _id immutability is validated by mingo (vendor/mingo build)
      const docs = [...cache.values()]
      const result = mingoUpdateMany(docs, filter, update as Modifier)

      if (result.modifiedCount === 0) {
        return { acknowledged: true, matchedCount: result.matchedCount, modifiedCount: 0 }
      }

      // Persist all matched docs (mingo doesn't expose which specific docs changed)
      // Note: cache already updated since docs array contains same object refs
      // This may persist unchanged docs, but writes are idempotent
      const matched = new Query(filter).find(docs).all() as T[]
      const persistedIds: string[] = []

      for (const doc of matched) {
        try {
          await prefixed.setItem(doc._id, doc)
          persistedIds.push(doc._id)
        } catch (err) {
          // Some docs persisted, some didn't - inconsistent state
          throw new StorageWriteError(
            `Failed to persist updateMany (${persistedIds.length}/${matched.length} persisted)`,
            "update",
            matched.map((d) => d._id),
            err
          )
        }
      }

      return { acknowledged: true, ...result }
    },

    async deleteOne(filter) {
      await ready

      const matches = new Query(filter).find([...cache.values()]).all() as T[]
      const doc = matches[0]
      if (!doc) {
        return { acknowledged: true, deletedCount: 0 }
      }

      cache.delete(doc._id)
      try {
        await prefixed.removeItem(doc._id)
      } catch (err) {
        throw new StorageWriteError(
          `Failed to persist deleteOne for ${doc._id}`,
          "delete",
          [doc._id],
          err
        )
      }

      return { acknowledged: true, deletedCount: 1 }
    },

    async deleteMany(filter) {
      await ready

      const matches = new Query(filter).find([...cache.values()]).all() as T[]
      if (matches.length === 0) {
        return { acknowledged: true, deletedCount: 0 }
      }

      const deletedIds: string[] = []
      for (const doc of matches) {
        cache.delete(doc._id)
        try {
          await prefixed.removeItem(doc._id)
          deletedIds.push(doc._id)
        } catch (err) {
          throw new StorageWriteError(
            `Failed to persist deleteMany (${deletedIds.length}/${matches.length} deleted)`,
            "delete",
            matches.map((d) => d._id),
            err
          )
        }
      }

      return { acknowledged: true, deletedCount: matches.length }
    },

    async [Symbol.asyncDispose]() {
      disposed = true
      await ready // Wait for initialization to complete before cleanup
      unwatch?.()
      cache.clear()
    }
  }
}
