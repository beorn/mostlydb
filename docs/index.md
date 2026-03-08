---
layout: home
hero:
  name: mostlydb
  tagline: MongoDB queries over any storage backend.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /reference/api
features:
  - title: MongoDB Query API
    details: Use familiar MongoDB query syntax -- $gt, $in, $regex, nested fields, and more -- powered by Mingo.
  - title: In-Memory Cache
    details: Documents are loaded once into memory. Queries run locally in O(n) instead of N network round-trips.
  - title: Any Storage Backend
    details: Built on unstorage -- works with memory, filesystem, Redis, HTTP, S3, Cloudflare KV, and any custom driver.
  - title: Write Operations
    details: Full MongoDB-style writes -- insertOne, updateOne, updateMany, deleteOne, deleteMany with update operators.
  - title: Watch-Based Sync
    details: Subscribe to external changes via driver watch(). The cache stays consistent without polling.
  - title: AsyncDisposable
    details: Clean resource management with the using keyword. Watchers and cache are properly cleaned up.
---
