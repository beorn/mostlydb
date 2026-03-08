# Queries

MostlyDB supports MongoDB query syntax via [Mingo](https://github.com/kofrasa/mingo). Queries run against the in-memory cache, so they are fast and do not hit the storage backend.

## find()

Returns a `Cursor` that supports chaining:

```typescript
const cursor = db.find({ status: "active" })
const results = await cursor.toArray()
```

### Cursor Methods

Each method returns a new cursor (immutable):

```typescript
const results = await db.find({ department: "engineering" })
  .sort({ salary: -1 })     // Sort descending by salary
  .skip(20)                  // Skip first 20 results
  .limit(10)                 // Take 10 results
  .toArray()                 // Execute and return array
```

## findOne()

Returns the first matching document or `null`:

```typescript
const user = await db.findOne({ email: "alice@example.com" })
if (user) {
  console.log(user.name)
}
```

## count()

Returns the number of matching documents:

```typescript
const total = await db.count()                          // All documents
const active = await db.count({ status: "active" })     // Filtered count
```

## Query Operators

### Comparison

```typescript
db.find({ age: { $gt: 18 } })          // Greater than
db.find({ age: { $gte: 18 } })         // Greater than or equal
db.find({ age: { $lt: 65 } })          // Less than
db.find({ age: { $lte: 65 } })         // Less than or equal
db.find({ age: { $ne: 0 } })           // Not equal
db.find({ status: { $in: ["active", "pending"] } })    // In array
db.find({ status: { $nin: ["deleted"] } })              // Not in array
```

### Logical

```typescript
db.find({ $and: [{ age: { $gte: 18 } }, { status: "active" }] })
db.find({ $or: [{ role: "admin" }, { role: "moderator" }] })
db.find({ age: { $not: { $lt: 18 } } })
```

### Element

```typescript
db.find({ email: { $exists: true } })   // Field exists
```

### Evaluation

```typescript
db.find({ name: { $regex: /^A/i } })    // Regex match
```

### Nested Fields

```typescript
db.find({ "address.city": "Berlin" })    // Dot notation for nested fields
```

### Array Queries

```typescript
db.find({ tags: "typescript" })                    // Array contains value
db.find({ tags: { $all: ["typescript", "bun"] } }) // Array contains all
db.find({ "scores.0": { $gt: 90 } })              // Array index
```

## Examples

### Pagination

```typescript
async function getPage(page: number, pageSize: number) {
  return db.find({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray()
}
```

### Complex Filters

```typescript
const results = await db.find({
  $and: [
    { status: "active" },
    { age: { $gte: 18, $lte: 65 } },
    { $or: [
      { role: "engineer" },
      { department: "engineering" },
    ]},
  ],
}).sort({ name: 1 }).toArray()
```
