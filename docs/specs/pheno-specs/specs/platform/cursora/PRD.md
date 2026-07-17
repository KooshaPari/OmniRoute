# PRD: relay — Cursor-Based Pagination Library

## Overview
`relay` is a TypeScript cursor-based pagination library that works with any data source: SQL, NoSQL, and REST APIs. It implements the Relay Connection Specification (GraphQL Cursor Connections) while being usable outside GraphQL contexts.

## Problem Statement
Offset-based pagination (`LIMIT x OFFSET y`) has poor performance at large offsets and produces inconsistent results when data is modified between pages. Cursor-based pagination is more efficient and consistent but complex to implement correctly for every data source. `relay` standardizes this across all Phenotype services.

## Goals
1. Cursor-based pagination compatible with the Relay Connection Specification
2. Adapters for SQL (raw, Prisma, Drizzle), MongoDB, and REST APIs
3. Bidirectional pagination (forward and backward)
4. Optional total count with efficient counting
5. TypeScript type safety throughout

## Epics

### E1: Connection Model
- E1.1: `Connection<T>` type (edges, pageInfo, totalCount)
- E1.2: `Edge<T>` type (node, cursor)
- E1.3: `PageInfo` type (hasNextPage, hasPreviousPage, startCursor, endCursor)
- E1.4: Cursor encoding/decoding (opaque base64 cursors)

### E2: Query Arguments
- E2.1: Forward pagination (first, after)
- E2.2: Backward pagination (last, before)
- E2.3: Argument validation (cannot mix forward and backward)
- E2.4: Default page size configuration

### E3: SQL Adapter
- E3.1: Raw SQL query builder with cursor WHERE clause injection
- E3.2: Prisma adapter
- E3.3: Drizzle ORM adapter
- E3.4: Multi-column cursor support (for stable sort on non-unique columns)

### E4: MongoDB Adapter
- E4.1: MongoDB cursor-based pagination
- E4.2: Compound sort key support
- E4.3: Motor async support

### E5: GraphQL Integration
- E5.1: Connection type generator for GraphQL schema
- E5.2: Resolver helper: `paginate(query, args) -> Connection<T>`
- E5.3: Type-GraphQL integration
