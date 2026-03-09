# mostlydb

MongoDB queries over any storage backend.

mostlydb wraps any [unstorage](https://unstorage.unjs.io/) driver with an in-memory cache and MongoDB-style query API. Instead of N network requests per query, documents are loaded once into memory and queried locally using [Mingo](https://github.com/kofrasa/mingo). Watch-based sync keeps the cache up to date with external changes.

## Quick Start

```bash
bun add mostlydb
```

```typescript
import { createStorage, MostlyDB } from "mostlydb"

const storage = createStorage({ driver: myDriver })
const db = MostlyDB<{ _id: string; name: string; age: number }>(storage, "users:")

// Insert
await db.insertOne({ name: "Alice", age: 30 })

// Query with MongoDB syntax
const adults = await db.find({ age: { $gte: 18 } })
  .sort({ name: 1 })
  .limit(10)
  .toArray()

// Update with operators
await db.updateOne({ name: "Alice" }, { $set: { age: 31 } })

// Delete
await db.deleteMany({ age: { $lt: 18 } })
```

## API Overview

### CRUD Operations

| Method | Description |
|--------|-------------|
| `get(key)` | Get document by key |
| `set(key, value)` | Set document (infers `_id` from key) |
| `del(key)` | Delete document by key |
| `keys(base?)` | List keys with optional prefix filter |
| `insertOne(doc)` | Insert document (auto-generates `_id`) |
| `updateOne(filter, update)` | Update first matching document |
| `updateMany(filter, update)` | Update all matching documents |
| `deleteOne(filter)` | Delete first matching document |
| `deleteMany(filter)` | Delete all matching documents |

### Query Operations

| Method | Description |
|--------|-------------|
| `find(query?)` | Returns a chainable `Cursor` |
| `findOne(query?)` | Returns first match or `null` |
| `count(query?)` | Count matching documents |

### Cursor

```typescript
db.find({ status: "active" })
  .sort({ createdAt: -1 })
  .skip(20)
  .limit(10)
  .toArray()
```

### Update Operators

`$set`, `$unset`, `$inc`, `$push`, `$pull`, `$addToSet`, `$pop`, `$rename`

### Storage Helpers

- `createStorage({ driver })` -- patches `getAll` from driver for bulk loading
- `prefixStorage(storage, prefix)` -- namespace isolation with `getAll` support

### Error Handling

`StorageWriteError` is thrown when backend persistence fails. The cache may be inconsistent -- callers should restart the application.

## License

MIT
