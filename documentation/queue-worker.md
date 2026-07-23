# Queue & Worker System

To prevent API endpoints from hanging during slow repository actions (like cloning, running agents, and validating builds), Avenor uses a queue-based asynchronous processing architecture.

---

## Technical Stack
* **BullMQ**: A robust queue library for Node.js based on Redis streams.
* **Redis**: Acts as the message broker, storing job state and queue payloads.
* **Prisma (PostgreSQL)**: Serves as the persistent database tracking the history, status, and relationship mappings of Avenor analysis jobs.

---

## Job Enqueuing Flow (`pipeline.queue.ts`)

When an analysis is triggered (via API or Webhook), it calls `addPipelineJob`:

1. **Job Prefix**: Prepends `"analyze"` or `"resume"` to the job name depending on whether a `userAnswer` is provided.
2. **Database Job Record Creation**:
   * If no `prismaJobId` is passed, it creates a new `Job` record in PostgreSQL with status `RUNNING`.
   * If a `prismaJobId` is passed (meaning it is resuming a paused job), it updates the existing `Job` status back to `RUNNING`.
3. **Queue Payload Enqueuing**: Adds the task to `pipelineQueue` (BullMQ) with automated retry configurations (3 attempts with exponential backoff of 5 seconds) and queue cleanup policies (preserves completed jobs for 1 hour and failed jobs for 24 hours).

---

## Job Processing Worker (`pipeline.worker.ts`)

A background worker instance processes queued tasks using a single-threaded concurrency limit (concurrency: 2).

### Worker Execution Lifecycle

```
[Job Dequeued] ──► Update Prisma Job to RUNNING 
                      │
                      ▼
            [analyzeRepository()]
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
 [fixes.userInputRequired]  [Fix Completed]
         │                         │
         ▼                         ▼
  Prisma Job updated to      Prisma Job updated to
  WAITING_FOR_USER           COMPLETED
         │                         │
         ▼                         ▼
  Worker finishes loop       Worker finishes loop
  (doesn't block queue)     (closes issue & creates PR)
```

1. **Prisma State Sync**: Sets the Prisma Job status to `RUNNING` in the database.
2. **Core Execution**: Invokes `analyzeRepository`.
3. **Pausing State (`WAITING_FOR_USER`)**:
   If an agent calls the `ask_user` tool:
   * The worker catches the `userInputRequired` flag in the result.
   * Updates the Prisma Job status to `WAITING_FOR_USER`.
   * Finishes the BullMQ job successfully (which releases the queue worker thread so it can process other repositories).
4. **Completion State (`COMPLETED`)**:
   If the pipeline runs to completion (creating a pull request and closing the issue):
   * Updates the Prisma Job status to `COMPLETED`.
   * Sets `completedAt` timestamp.
5. **Failure State (`FAILED`)**:
   If any unhandled error is thrown during pipeline execution (e.g. clone timeout, git authorization issues):
   * Catches the exception.
   * Updates the Prisma Job status to `FAILED`.
   * Throws the error to BullMQ to trigger retry attempts.
