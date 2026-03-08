# Write Operations

MostlyDB provides MongoDB-style write operations. All writes follow a cache-first strategy: the in-memory cache is updated immediately, then the change is persisted to the storage backend.

## insertOne

Insert a new document. If `_id` is not provided, a UUID is generated.

```typescript
// Auto-generated _id
const result = await db.insertOne({ name: "Alice", age: 30 })
console.log(result.insertedId) // "550e8400-e29b-..."
console.log(result.acknowledged) // true

// Explicit _id
const result = await db.insertOne({ _id: "alice", name: "Alice", age: 30 })
```

Throws `Error` if a document with the same `_id` already exists.

## updateOne

Update the first document matching the filter:

```typescript
const result = await db.updateOne(
  { name: "Alice" },
  { $set: { age: 31 } }
)
console.log(result.matchedCount)  // 1
console.log(result.modifiedCount) // 1
```

## updateMany

Update all documents matching the filter:

```typescript
const result = await db.updateMany(
  { status: "pending" },
  { $set: { status: "active" } }
)
console.log(result.matchedCount)  // 5
console.log(result.modifiedCount) // 5
```

## deleteOne

Delete the first document matching the filter:

```typescript
const result = await db.deleteOne({ name: "Alice" })
console.log(result.deletedCount) // 1
```

## deleteMany

Delete all documents matching the filter:

```typescript
const result = await db.deleteMany({ status: "inactive" })
console.log(result.deletedCount) // 12
```

## Update Operators

The following MongoDB update operators are supported:

### $set

Set field values:

```typescript
await db.updateOne({ _id: "alice" }, { $set: { age: 31, city: "Berlin" } })
```

### $unset

Remove fields:

```typescript
await db.updateOne({ _id: "alice" }, { $unset: { temporaryField: "" } })
```

### $inc

Increment numeric fields:

```typescript
await db.updateOne({ _id: "alice" }, { $inc: { loginCount: 1, score: -5 } })
```

### $push

Append to arrays:

```typescript
await db.updateOne({ _id: "alice" }, { $push: { tags: "admin" } })
```

### $pull

Remove from arrays:

```typescript
await db.updateOne({ _id: "alice" }, { $pull: { tags: "guest" } })
```

### $addToSet

Add to array only if not already present:

```typescript
await db.updateOne({ _id: "alice" }, { $addToSet: { roles: "editor" } })
```

### $pop

Remove first (-1) or last (1) element from array:

```typescript
await db.updateOne({ _id: "alice" }, { $pop: { queue: -1 } })  // Remove first
await db.updateOne({ _id: "alice" }, { $pop: { queue: 1 } })   // Remove last
```

### $rename

Rename a field:

```typescript
await db.updateOne({ _id: "alice" }, { $rename: { oldField: "newField" } })
```

## Error Handling

If the storage backend fails to persist a write, a `StorageWriteError` is thrown. At this point the in-memory cache has already been updated, so there is an inconsistency between cache and backend.

```typescript
import { StorageWriteError } from "mostlydb"

try {
  await db.insertOne({ name: "Alice" })
} catch (err) {
  if (err instanceof StorageWriteError) {
    console.error(err.operation)    // "insert" | "update" | "delete"
    console.error(err.affectedIds)  // ["alice"]
    // Restart the application to restore consistency
  }
}
```

The error message includes "(restart required to restore consistency)" to signal that the application should be restarted.

## Concurrency

MostlyDB uses a "Last Write Wins" strategy. KV storage backends do not support transactions, so concurrent updates to the same document will result in the last write winning. For applications that need stronger consistency, use a proper database.
