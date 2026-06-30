# QADRANT

A personal, agent-readable time tracker with a terminal-editorial aesthetic. Backed by PocketBase.

## PocketBase Backend Setup

Qadrant stores all time entries in a PocketBase instance. Setting up PocketBase properly is required for the application to function.

### 1. Database Collections
Ensure you configure the following collections in your PocketBase instance:
* **users**: An auth collection with custom field `space_colors` (json, default `{}`).
* **time_entries**: A collection with fields:
  * `user` (Relation, points to `users` collection, required)
  * `space` (Text, required)
  * `specialization` (Text, optional)
  * `start_time` (DateTime, required)
  * `completion_time` (DateTime, optional)

### 2. Batch Request Configuration (Required)
Qadrant utilizes transactional batch updates to handle space and specialization renaming efficiently and securely (avoiding API rate-limiting failures).

By default, PocketBase disables batch requests. **You must explicitly enable them in the Admin UI:**
1. Navigate to **Settings** (gear icon) > **Application**.
2. Select the **Batch** section.
3. Toggle the **Enabled** switch to **ON**.
4. Configure the following recommended limits:
   * **Max Requests:** `200` (comfortably accommodates Qadrant's chunk size of 100).
   * **Max Processing Time:** `10` seconds (prevents SQLite database locking).
   * **Max Body Size:** `10485760` bytes (10 MB, secure and protective of server memory).
5. Click **Save Changes** in the top right.

## Getting Started

### Environment Configuration
Create a `.env.local` file in the root directory:
```env
VITE_POCKETBASE_URL=https://your-pocketbase-instance.com
```

### Run Client
```bash
npm install
npm run dev
```
