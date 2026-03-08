# mostlydb

MongoDB-style queries over unstorage backends. TypeScript, Bun.

## What It Does

- In-memory cache for O(n) queries over any unstorage driver
- MongoDB query syntax via Mingo (find, sort, limit, skip)
- CRUD: get/set/del/keys + insertOne/updateOne/updateMany/deleteOne/deleteMany
- Update operators: $set, $unset, $inc, $push, $pull, $addToSet, $pop, $rename
- Watch-based sync keeps cache consistent with external changes
- createStorage/prefixStorage wrappers that preserve getAll for bulk loading
- AsyncDisposable, Cursor API, StorageWriteError

## Commands

```bash
bun install
bun run docs:dev      # VitePress dev server
bun run docs:build    # Build docs for deployment
```

## Structure

```
src/
  index.ts           # Public exports
  mostlydb.ts        # Core MostlyDB implementation
  create-storage.ts  # createStorage/prefixStorage wrappers
docs/                # VitePress documentation site
```
