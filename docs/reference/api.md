# API Reference

## MostlyDB

### `MostlyDB<T>(storage, prefix, options?)`

Create a MostlyDB instance wrapping a storage backend.

```typescript
import { MostlyDB } from "mostlydb"

const db = MostlyDB<User>(storage, "users:")
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `storage` | `Storage \| StorageWithGetAll` | An unstorage instance |
| `prefix` | `string` | Key prefix for namespace isolation |
| `options` | `MostlyDBOptions` | Reserved for future use |

**Returns:** `MostlyDB<T>` -- implements `AsyncDisposable`

On creation, MostlyDB:
1. Starts watching for external changes (if the driver supports `watch()`)
2. Loads all documents into the in-memory cache (via `getAll` or `getKeys` + `getItems`)
3. Applies any watch events that arrived during loading

### Key-Value Operations

#### `get(key): Promise<T | null>`

Retrieve a document by its key.

```typescript
const user = await db.get("alice")
```

#### `set(key, value): Promise<void>`

Set a document. Infers `_id` from the key if not present in the value. Throws if `value._id` is present but does not match the key.

```typescript
await db.set("alice", { name: "Alice", age: 30 })
// Stored as: { _id: "alice", name: "Alice", age: 30 }
```

#### `del(key): Promise<void>`

Delete a document by key.

```typescript
await db.del("alice")
```

#### `keys(base?): Promise<string[]>`

List all keys, optionally filtered by a prefix.

```typescript
const allKeys = await db.keys()
const adminKeys = await db.keys("admin-")
```

### Query Operations

#### `find(query?): Cursor<T>`

Create a cursor for matching documents. The query uses MongoDB syntax.

```typescript
const cursor = db.find({ age: { $gte: 18 } })
const results = await cursor.toArray()
```

Without a query, matches all documents.

#### `findOne(query?): Promise<T | null>`

Return the first matching document or `null`.

```typescript
const user = await db.findOne({ email: "alice@example.com" })
```

#### `count(query?): Promise<number>`

Count matching documents. Without a query, returns the total document count (using cache size directly).

```typescript
const total = await db.count()
const active = await db.count({ status: "active" })
```

### Write Operations

#### `insertOne(doc): Promise<InsertOneResult>`

Insert a document. Generates a UUID for `_id` if not provided. Throws `Error` on duplicate `_id`.

```typescript
const result = await db.insertOne({ name: "Alice", age: 30 })
// result: { acknowledged: true, insertedId: "550e8400-..." }
```

#### `updateOne(filter, update): Promise<UpdateResult>`

Update the first document matching the filter using update operators.

```typescript
const result = await db.updateOne({ name: "Alice" }, { $set: { age: 31 } })
// result: { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
```

#### `updateMany(filter, update): Promise<UpdateResult>`

Update all documents matching the filter.

```typescript
const result = await db.updateMany({ status: "pending" }, { $set: { status: "active" } })
// result: { acknowledged: true, matchedCount: 5, modifiedCount: 5 }
```

#### `deleteOne(filter): Promise<DeleteResult>`

Delete the first document matching the filter.

```typescript
const result = await db.deleteOne({ name: "Alice" })
// result: { acknowledged: true, deletedCount: 1 }
```

#### `deleteMany(filter): Promise<DeleteResult>`

Delete all documents matching the filter.

```typescript
const result = await db.deleteMany({ status: "inactive" })
// result: { acknowledged: true, deletedCount: 12 }
```

### Disposal

#### `[Symbol.asyncDispose](): Promise<void>`

Stop watching for changes and clear the cache.

```typescript
await db[Symbol.asyncDispose]()

// Or use the `using` keyword:
{
  await using db = MostlyDB<User>(storage, "users:")
  // ...
} // automatically disposed
```

---

## Cursor

Immutable cursor returned by `find()`. Each method returns a new cursor.

#### `sort(spec): Cursor<T>`

Sort results. Use `1` for ascending, `-1` for descending.

```typescript
cursor.sort({ name: 1, age: -1 })
```

#### `limit(n): Cursor<T>`

Limit the number of results.

```typescript
cursor.limit(10)
```

#### `skip(n): Cursor<T>`

Skip the first `n` results.

```typescript
cursor.skip(20)
```

#### `toArray(): Promise<T[]>`

Execute the query and return results as an array.

```typescript
const results = await cursor.toArray()
```

---

## createStorage

### `createStorage<T>({ driver }): StorageWithGetAll<T>`

Wrapper around unstorage's `createStorage` that patches `getAll` from the driver onto the storage instance, if the driver supports it.

```typescript
import { createStorage } from "mostlydb"

const storage = createStorage({ driver: myDriver })

// If driver has getAll, it's now available:
if (storage.getAll) {
  const items = await storage.getAll()
}
```

---

## prefixStorage

### `prefixStorage<T>(storage, prefix): StorageWithGetAll<T>`

Wrapper around unstorage's `prefixStorage` that preserves `getAll` with prefix filtering.

```typescript
import { prefixStorage } from "mostlydb"

const usersStorage = prefixStorage(storage, "users:")
// getAll() results are filtered and keys have prefix stripped
```

---

## StorageWriteError

Error thrown when backend persistence fails after the cache has been updated.

```typescript
import { StorageWriteError } from "mostlydb"

try {
  await db.insertOne({ name: "Alice" })
} catch (err) {
  if (err instanceof StorageWriteError) {
    err.operation   // "insert" | "update" | "delete"
    err.affectedIds // string[]
    err.cause       // original error
  }
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `operation` | `"insert" \| "update" \| "delete"` | The operation that failed |
| `affectedIds` | `string[]` | IDs of documents affected |
| `cause` | `unknown` | The underlying error |
