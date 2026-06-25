# Design Specification: Rename Spaces and Specializations (Web SPA)

This design document details the implementation of a client-side space and specialization renaming feature in the **qadrant** Web SPA, enabling users to maintain consistent category naming in their tracking history.

## 1. Overview & Scope

- **Goal**: Allow users to rename a space (e.g. `"Work"` to `"Job"`) or rename a specialization of a given space (e.g. `"Work / meeting"` to `"Work / sync"`).
- **Scope**: Web SPA only (changes limited to the React frontend). The CLI and MCP tools will see the results of these renames automatically because they read the same underlying database records.
- **Backend Architecture Constraint**: Since spaces and specializations are stored denormalized on every time entry (rather than a separate metadata collection), a rename is implemented as a client-side batch migration using the PocketBase Batch API.

---

## 2. User Interface Design (SPA Settings Tab)

The renaming affordance will be integrated into the existing **Space Theme Mappings** card inside [Settings.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.tsx).

### 2.1. Space List Layout
Each space container will group the space details and its associated specializations:
1. **Space Row**: Shows the space name, a text button `[RENAME]`, and the color swatch picker.
2. **Specializations List**: If a space has associated specializations in the user's tracking history, they are listed below it. Each specialization is rendered as a clean badge containing the name and a small `[RENAME]` button.

```
+------------------------------------------------------+
  SPACE_THEME_MAPPINGS
  
  Assign a marker for each space detected in your history.
  
  +--------------------------------------------------+
  | WORK                               [Color Swatch]|
  | [RENAME]                                         |
  | ------------------------------------------------ |
  | SPECIALIZATIONS:                                 |
  | [ MEETING ] [RENAME]  [ FRONTEND ] [RENAME]      |
  +--------------------------------------------------+
  
  +--------------------------------------------------+
  | PIANO                              [Color Swatch]|
  | [RENAME]                                         |
  +--------------------------------------------------+
+------------------------------------------------------+
```

### 2.2. Rename Modals
* **Space Rename Modal (`RENAME_SPACE_PROTOCOL`)**:
  * Title: `▸  RENAME_SPACE_PROTOCOL`
  * Body: Current name and a text input field for the new name.
  * Validation: Required, max 48 characters, unique (cannot conflict with another existing space).
* **Specialization Rename Modal (`RENAME_SPECIALIZATION_PROTOCOL`)**:
  * Title: `▸  RENAME_SPECIALIZATION_PROTOCOL`
  * Body: Current space context, current specialization, and a text input field for the new specialization name.
  * Validation: Required, max 48 characters, unique within the space.

### 2.3. Loading / Progress Overlay
During the batch update, an overlay is displayed on top of the active modal containing:
* The `BeatIndicator` animation.
* Status text showing progress: `>>> RENAME_IN_PROGRESS // CHUNK X OF Y...` (e.g. `CHUNK 2 OF 5...`).

---

## 3. Database & Data-Flow Logic

### 3.1. Reading Specializations
In [Settings.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.tsx), when fetching all time entries, we group detected specializations by space:
```typescript
interface SpaceGroup {
  name: string;
  specializations: string[];
}
```
This is populated on-the-fly from the `entries` fetched during component mount.

### 3.2. Rename Execution Workflow

#### Step 1: Fetch Target Entries
* **Renaming a Space**: Fetch all records from the `time_entries` collection where `space === oldSpaceName`.
* **Renaming a Specialization**: Fetch all records from the `time_entries` collection where `space === spaceName && specialization === oldSpecName`.

#### Step 2: Batch Update (Chunking)
SQLite (PocketBase's engine) handles small sequential writes more gracefully than massive single locks. We will chunk the target entries and update them sequentially:
- **Chunk Size**: 100 entries.
- **API Call**: Loop through chunks. For each chunk:
  ```typescript
  const batch = pb.createBatch();
  for (const entry of chunk) {
    batch.collection('time_entries').update(entry.id, {
      space: newSpaceName, // (or specialization: newSpecName)
    });
  }
  await batch.send();
  ```

#### Step 3: Update Color Mappings (Spaces Only)
If a space is renamed:
1. Load the user's `space_colors` JSON dictionary.
2. If `oldSpaceName` exists as a key:
   * Copy the color to `newSpaceName`.
   * Delete `oldSpaceName` from the dictionary.
3. Update the user preferences:
   ```typescript
   await pb.collection('users').update(userId, { space_colors: updatedColors });
   ```

#### Step 4: Refresh UI State
Upon successful migration, refresh the list of entries in [Settings.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.tsx) state and close the modal.
