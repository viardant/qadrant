# Robust Rename and Merge Design Specification

## Overview
The "rename" feature for spaces and specializations currently performs updates on individual records in parallel batches of 10. For datasets with thousands of entries, this generates a massive amount of sequential HTTP requests, causing rate-limiting failures (HTTP 429) when routed through Cloudflare tunnels. Furthermore, if a failure occurs midway:
1. Some records are left in the old space/specialization, while others are in the new one.
2. The user cannot rename the remaining records to the new space/specialization because validation blocks renaming to an existing name ("A space with this name already exists").

This specification designs a robust client-side batching and retry system to prevent rate limit issues and replaces the hard validation block with a confirmation warning that permits merging (and thus, recovery).

## Objectives
1. **Reduce Request Volume:** Leverage PocketBase's transactional Batch Service (`pb.createBatch()`) to perform updates in chunks of 100 in a single network request.
2. **Resilience to Rate Limits:** Wrap batch requests with a retry utility implementing exponential backoff.
3. **Allow Merging and Recovery:** Replace the hard validation block on existing names with a warning banner and a `CONFIRM_MERGE` confirmation step, enabling users to complete an interrupted rename or intentionally merge spaces.

## Technical Details

### 1. Exponential Backoff Retry Utility
Add a helper function to retry batch network calls on failure:
```typescript
async function runWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    console.warn(`Request failed. Retrying in ${delayMs}ms...`, err);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return runWithRetry(fn, retries - 1, delayMs * 2);
  }
}
```

### 2. Transactional Batch Execution
Update `executeRenameSpace` and `executeRenameSpec` to use `pb.createBatch()`:
- Increase `RENAME_BATCH_SIZE` to 100.
- For each batch, register updates:
  ```typescript
  const batch = pb.createBatch();
  for (const entry of batchItems) {
    batch.collection('time_entries').update(entry.id, { space: targetNew });
  }
  await runWithRetry(() => batch.send());
  ```
- Since `pb.createBatch()` is executed atomically on the server side:
  - If any update in the batch fails, the entire batch rolls back.
  - If the operation is interrupted, the client only leaves clean chunks of 100 in the new state, reducing fragmentation.

### 3. Merging and Preference Updates
- **Validation Change:** Instead of throwing a blocking error if `targetNew` already exists, we permit the execution.
- **Color Settings:** When renaming/merging space `A` to `B`:
  - If space `B` does not have a custom color in the user's `space_colors` mapping, copy `A`'s color to `B`.
  - Delete `A`'s entry in `space_colors`.
  - Save the updated preferences to the `users` collection.

### 4. UI / UX Warning Banner
In the settings page rename modals:
- Check if the trimmed input name matches an existing name (case-insensitive) other than the current name.
- If true, display a warning banner:
  > **⚠️ Warning:** A space/specialization with this name already exists. Executing this rename will merge all entries into it.
- Dynamically alter the submit button text:
  - Default: `>>> EXECUTE_RENAME`
  - Merging: `>>> CONFIRM_MERGE`
  - Loading: `EXECUTING...`

## Verification Plan
1. **Unit Tests:** Update `Settings.test.tsx` to accommodate the change in validation (from blocked error to warning) and test the successful merge path.
2. **Batching Verification:** Mock the pocketbase batch service inside tests to verify `pb.createBatch()` is invoked correctly.
3. **Manual Verification:** Rename spaces with multiple entries, verify color preferences transfer, and verify that partial renames can be completed successfully.
