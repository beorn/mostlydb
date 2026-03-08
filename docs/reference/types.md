# Types

All types are exported from the main `mostlydb` entry point.

```typescript
import type {
  IMostlyDB,
  Cursor,
  MostlyDBOptions,
  MostlyDBDocument,
  InsertOneResult,
  UpdateResult,
  DeleteResult,
  UpdateFilter,
  UpdateOperator,
  StorageWithGetAll,
  DriverWithGetAll,
  Storage,
  Driver,
} from "mostlydb"
```

## Core Types

### `MostlyDBDocument`

Base type for all documents stored in MostlyDB. Every document must have a string `_id`.

```typescript
type MostlyDBDocument = { _id: string }
```

### `IMostlyDB<T>`

The MostlyDB instance interface. Extends `AsyncDisposable`.

```typescript
interface IMostlyDB<T extends MostlyDBDocument> extends AsyncDisposable {
  get(key: string): Promise<T | null>
  set(key: string, value: Omit<T, "_id"> & { _id?: string }): Promise<void>
  del(key: string): Promise<void>
  keys(base?: string): Promise<string[]>

  find(query?: QueryFilter): Cursor<T>
  findOne(query?: QueryFilter): Promise<T | null>
  count(query?: QueryFilter): Promise<number>

  insertOne(doc: Omit<T, "_id"> & { _id?: string }): Promise<InsertOneResult>
  updateOne(filter: QueryFilter, update: UpdateFilter<T>): Promise<UpdateResult>
  updateMany(filter: QueryFilter, update: UpdateFilter<T>): Promise<UpdateResult>
  deleteOne(filter: QueryFilter): Promise<DeleteResult>
  deleteMany(filter: QueryFilter): Promise<DeleteResult>
}
```

::: tip
The factory function is named `MostlyDB` while the interface type is exported as `IMostlyDB` to avoid conflicts.
:::

### `Cursor<T>`

Immutable cursor for query results. Each method returns a new cursor instance.

```typescript
interface Cursor<T> {
  sort(spec: Record<string, 1 | -1>): Cursor<T>
  limit(n: number): Cursor<T>
  skip(n: number): Cursor<T>
  toArray(): Promise<T[]>
}
```

### `MostlyDBOptions`

Configuration options for MostlyDB (reserved for future use).

```typescript
interface MostlyDBOptions {
  // Reserved for future options
}
```

## Result Types

### `InsertOneResult`

```typescript
interface InsertOneResult {
  acknowledged: boolean
  insertedId: string
}
```

### `UpdateResult`

```typescript
interface UpdateResult {
  acknowledged: boolean
  matchedCount: number
  modifiedCount: number
}
```

### `DeleteResult`

```typescript
interface DeleteResult {
  acknowledged: boolean
  deletedCount: number
}
```

## Update Types

### `UpdateFilter<T>`

MongoDB-style update filter with operators.

```typescript
type UpdateFilter<T> = {
  $set?: Partial<T>
  $unset?: Partial<Record<keyof T, "" | true | 1>>
  $inc?: Partial<Record<keyof T, number>>
  $push?: Partial<Record<keyof T, unknown>>
  $pull?: Partial<Record<keyof T, unknown>>
  $addToSet?: Partial<Record<keyof T, unknown>>
  $pop?: Partial<Record<keyof T, 1 | -1>>
  $rename?: Partial<Record<keyof T, string>>
}
```

### `UpdateOperator`

Union of supported update operator names.

```typescript
type UpdateOperator =
  | "$set" | "$unset" | "$inc" | "$push"
  | "$pull" | "$addToSet" | "$pop" | "$rename"
```

## Storage Types

### `StorageWithGetAll<T>`

Extended storage interface with optional `getAll` method for bulk loading.

```typescript
interface StorageWithGetAll<T extends StorageValue = StorageValue> extends Storage<T> {
  getAll?: () => Promise<Array<{ key: string; value: T }>>
}
```

### `DriverWithGetAll`

Driver interface that optionally supports `getAll`.

```typescript
interface DriverWithGetAll extends Driver {
  getAll?: () => Promise<Array<{ key: string; value: unknown }>>
}
```

### `Storage`

Re-exported from `unstorage` for convenience.

### `Driver`

Re-exported from `unstorage` for convenience.
