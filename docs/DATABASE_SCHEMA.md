# EDITH – Database Schema Documentation

EDITH uses SQLite via SQLAlchemy 2.0 Async as its primary persistent relational store (`data/edith.db`).

## Tables Overview

### 1. `conversations`
Tracks multi-turn chat dialogues.
- `id` (VARCHAR(36), PK): UUID4 identifier.
- `title` (VARCHAR(255)): Human-readable conversation label.
- `created_at` (DATETIME): Initial creation timestamp.
- `updated_at` (DATETIME): Last updated timestamp.
- `is_archived` (BOOLEAN): Soft-deletion / archive flag.

### 2. `messages`
Individual interaction messages within a conversation.
- `id` (VARCHAR(36), PK): UUID4 identifier.
- `conversation_id` (VARCHAR(36), FK -> conversations.id ON DELETE CASCADE).
- `role` (VARCHAR(20)): 'user', 'assistant', 'system', 'tool'.
- `content` (TEXT): Complete message text or tool payload.
- `model_used` (VARCHAR(100), Nullable): Specific LLM or agent provider invoked.
- `tokens_used` (INTEGER): Total prompt + completion tokens.
- `created_at` (DATETIME): Message generation timestamp.
- *Index*: `idx_messages_conversation_created` on (`conversation_id`, `created_at`).

### 3. `tasks`
Personal productivity and scheduled automation items.
- `id` (VARCHAR(36), PK): UUID4 identifier.
- `title` (VARCHAR(255)): Task headline.
- `description` (TEXT, Nullable): Detailed requirements or notes.
- `status` (VARCHAR(30)): 'pending', 'in_progress', 'completed', 'cancelled'.
- `priority` (VARCHAR(20)): 'low', 'medium', 'high', 'critical'.
- `due_date` (DATETIME, Nullable): Due deadline.
- `created_at` (DATETIME): Creation timestamp.
- `completed_at` (DATETIME, Nullable): Completion timestamp.

### 4. `reminders`
Time-based alert triggers associated with tasks or stand-alone prompts.
- `id` (VARCHAR(36), PK): UUID4 identifier.
- `task_id` (VARCHAR(36), FK -> tasks.id ON DELETE CASCADE, Nullable).
- `message` (TEXT): Notification text.
- `trigger_at` (DATETIME): Exact execution timestamp.
- `recurrence_rule` (VARCHAR(100), Nullable): Interval or cron definition.
- `is_acknowledged` (BOOLEAN): Has the user dismissed the reminder.
- `created_at` (DATETIME): Record creation timestamp.

### 5. `user_facts`
Structured episodic memory extracted by background LLM workers.
- `id` (VARCHAR(36), PK): UUID4 identifier.
- `category` (VARCHAR(50)): 'preference', 'environment', 'personal', 'project'.
- `fact_content` (TEXT): Stored knowledge statement.
- `confidence_score` (FLOAT): Extraction confidence (0.0 to 1.0).
- `created_at` (DATETIME): Time learned.
- `last_verified` (DATETIME): Last corroborated or referenced timestamp.

### 6. `security_audit_logs`
Immutable audit log recording every automated tool execution attempt.
- `id` (VARCHAR(36), PK): UUID4 identifier.
- `action_name` (VARCHAR(100)): Target tool invoked.
- `risk_tier` (VARCHAR(50)): 'read_only', 'low_risk_reversible', 'sensitive', 'destructive_privileged'.
- `authorization_mode` (VARCHAR(50)): 'auto', 'voice_confirmed', 'gui_modal_confirmed', 'denied'.
- `parameters_json` (TEXT): Serialized argument payload.
- `status` (VARCHAR(30)): 'success', 'failed', 'rejected'.
- `executed_at` (DATETIME): Execution timestamp.

