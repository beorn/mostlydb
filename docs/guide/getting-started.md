# Getting Started

## Installation

```bash
bun add mostlydb
# or
npm install mostlydb
```

## Basic Usage

```typescript
import { createStorage, MostlyDB } from "mostlydb"
import fsDriver from "unstorage/drivers/fs"

// 1. Create a storage backend
const storage = createStorage({
  driver: fsDriver({ base: "./data" }),
})

// 2. Wrap with MostlyDB
interface User {
  _id: string
  name: string
  email: string
  age: number
}

const db = MostlyDB<User>(storage, "users:")
```

All documents must have an `_id: string` field. MostlyDB uses `_id` as the storage key.

## CRUD Operations

### Create

```typescript
// Insert with auto-generated _id
const result = await db.insertOne({ name: "Alice", email: "alice@example.com", age: 30 })
console.log(result.insertedId) // "550e8400-e29b-..."

// Insert with explicit _id
await db.insertOne({ _id: "alice", name: "Alice", email: "alice@example.com", age: 30 })

// Or use key-value style
await db.set("alice", { name: "Alice", email: "alice@example.com", age: 30 })
```

### Read

```typescript
// By key
const user = await db.get("alice")

// By query
const user = await db.findOne({ email: "alice@example.com" })

// Multiple results
const adults = await db.find({ age: { $gte: 18 } }).toArray()
```

### Update

```typescript
await db.updateOne(
  { name: "Alice" },
  { $set: { age: 31 }, $inc: { loginCount: 1 } }
)
```

### Delete

```typescript
await db.deleteOne({ name: "Alice" })
await db.deleteMany({ age: { $lt: 18 } })
```

## Cleanup

MostlyDB implements `AsyncDisposable` for automatic cleanup:

```typescript
{
  await using db = MostlyDB<User>(storage, "users:")
  // use db...
} // watchers stopped, cache cleared

// Or manually
const db = MostlyDB<User>(storage, "users:")
// ...
await db[Symbol.asyncDispose]()
```

## Storage Backends

MostlyDB works with any [unstorage driver](https://unstorage.unjs.io/drivers):

```typescript
import memoryDriver from "unstorage/drivers/memory"
import redisDriver from "unstorage/drivers/redis"
import httpDriver from "unstorage/drivers/http"

// In-memory (testing)
const storage = createStorage({ driver: memoryDriver() })

// Redis
const storage = createStorage({
  driver: redisDriver({ url: "redis://localhost:6379" }),
})

// HTTP API
const storage = createStorage({
  driver: httpDriver({ base: "https://api.example.com/storage" }),
})
```

The `createStorage` wrapper patches `getAll` from the driver if available, enabling efficient bulk loading instead of key-by-key fetching.
