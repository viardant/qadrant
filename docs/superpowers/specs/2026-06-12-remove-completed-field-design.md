# Design Specification: Redundant 'completed' Field Deprecation

This design document details the refactoring of **qadrant** to deprecate and remove the redundant `completed` boolean field from the database schema and all associated software layers.

## 1. Motivation
The `time_entries` collection in PocketBase currently maintains both:
* `completed` (boolean)
* `completion_time` (datetime/string, null when running)

Having both is redundant and error-prone, requiring developers to keep the two fields in sync. By removing `completed` entirely, we can determine active vs. completed sessions solely by checking if `completion_time` has a value.

---

## 2. Updated Data Schema (PocketBase)

### Collection: `time_entries`
* **Fields**:
  * `id`: text (system key)
  * `user`: relation to `users` (required, single, cascade delete)
  * `space`: text (required) — Top-level category/task name (e.g., "Work", "Piano")
  * `specialization`: text (optional) — Sub-level specialization detail (e.g., "Client A", "Designing schema")
  * `start_date`: date (required) — ISO timestamp of start
  * `completion_time`: date (optional) — ISO timestamp of stop (null if timer is active)

---

## 3. Query Filter Mapping (PocketBase API)

Since we are query filtering directly against PocketBase:
* **Active Timers**:
  * Previous Filter: `user='...' && completed=false`
  * New Filter: `user='...' && completion_time=""` (in PocketBase, empty/unset datetimes are checked against an empty string `""` or `null`)
* **Completed Timers**:
  * Previous Filter: `user='...' && completed=true`
  * New Filter: `user='...' && completion_time!=""`

---

## 4. Refactoring Areas

### 4.1. TypeScript Interfaces
Update the base `TimeEntry` and MCP `TimeEntryRecord` interfaces to remove `completed`.
```typescript
export interface TimeEntry {
  id: string;
  user: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string | null;
}
```

### 4.2. Vite Frontend
* **`Logger.tsx`**: Find the active session using `.find(r => !r.completion_time)`. Do not send `completed` when starting or stopping sessions.
* **`Ledger.tsx`**: Fetch list using `completion_time != ""`.
* **`Charts.tsx`** & **`transform.ts`**: Update parsing helper logic to filter completed entries using `!!e.completion_time`.
* **Tests**: Remove `completed` from mock structures.

### 4.3. CLI (`qadrant-cli`)
* **`index.ts`**: Replace `completed=false` with `completion_time=""` and `completed=true` with `completion_time!=""`. Remove `completed` from POST/PATCH request bodies.

### 4.4. MCP Server (`qadrant-mcp`)
* **`index.ts`**: Align query filters and request payloads with the new schema definition.
