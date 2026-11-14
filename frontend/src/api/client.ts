import { DetailedTelemetry, HealthResponse } from "../types";

const API_BASE = "http://127.0.0.1:18420";

export interface ModelInfo {
  name: string;
  description: string;
  type?: string;
  available?: boolean;
}

export interface AvailableModelsResponse {
  active_model: string;
  active_provider: string;
  installed_local_models: string[];
  suggested_local_models: ModelInfo[];
  cloud_models: ModelInfo[];
  hardware_mode: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model_used?: string;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  action_name: string;
  risk_tier: string;
  authorization_mode: string;
  parameters: Record<string, any>;
  status: string;
  executed_at: string;
}

export interface PendingActionItem {
  action_id: string;
  tool_name: string;
  risk_tier: string;
  parameters: Record<string, any>;
  description: string;
  requires_gui_modal: boolean;
  requires_voice_confirmation: boolean;
  confirmation_phrase?: string;
  created_at: number;
}

export interface UserFactItem {
  id: string;
  category: string;
  fact_content: string;
  confidence_score: number;
  created_at: string;
  last_verified: string;
}

export interface SemanticQueryResultItem {
  id: string;
  content: string;
  category: string;
  confidence: number;
  distance: number;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date?: string;
  created_at: string;
  completed_at?: string;
}

export interface ReminderItem {
  id: string;
  task_id?: string;
  message: string;
  trigger_at: string;
  is_acknowledged: boolean;
  created_at: string;
}

export interface DailyBriefingItem {
  generated_at: string;
  total_tasks: number;
  pending_tasks: number;
  completed_tasks: number;
  high_priority_tasks: TaskItem[];
  upcoming_reminders: ReminderItem[];
  spoken_summary: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  }

  async getTelemetry(): Promise<DetailedTelemetry> {
    const res = await fetch(`${API_BASE}/api/v1/system/telemetry`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Telemetry request failed: ${res.statusText}`);
    return res.json();
  }

  async getModels(): Promise<AvailableModelsResponse> {
    const res = await fetch(`${API_BASE}/api/v1/chat/models`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch models");
    return res.json();
  }

  async switchModel(modelName: string, provider?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/chat/models/switch`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ model_name: modelName, provider }),
    });
    if (!res.ok) throw new Error("Failed to switch model");
    return res.json();
  }

  async getConversations(): Promise<ConversationItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/chat/conversations`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch conversations");
    return res.json();
  }

  async createConversation(title?: string): Promise<ConversationItem> {
    const res = await fetch(`${API_BASE}/api/v1/chat/conversations`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ title: title || "New Conversation" }),
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    return res.json();
  }

  async getConversationMessages(conversationId: string): Promise<StoredMessage[]> {
    const res = await fetch(`${API_BASE}/api/v1/chat/conversations/${conversationId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch messages");
    return res.json();
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/chat/conversations/${conversationId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete conversation");
  }

  // Security & Actions
  async getPendingActions(): Promise<PendingActionItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/actions/pending`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch pending actions");
    return res.json();
  }

  async authorizeAction(actionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/actions/authorize/${actionId}`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to authorize action");
    return res.json();
  }

  async denyAction(actionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/actions/deny/${actionId}`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to deny action");
    return res.json();
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLogItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/actions/audit?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  }

  async getFacts(category?: string): Promise<UserFactItem[]> {
    const url = category
      ? `${API_BASE}/api/v1/memory/facts?category=${encodeURIComponent(category)}`
      : `${API_BASE}/api/v1/memory/facts`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch user facts");
    return res.json();
  }

  async createFact(
    factContent: string,
    category: string = "preference",
    confidence: number = 1.0
  ): Promise<UserFactItem> {
    const res = await fetch(`${API_BASE}/api/v1/memory/facts`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        fact_content: factContent,
        category,
        confidence_score: confidence,
      }),
    });
    if (!res.ok) throw new Error("Failed to create memory fact");
    return res.json();
  }

  async deleteFact(factId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/memory/facts/${factId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete memory fact");
  }

  async queryMemory(query: string, limit: number = 5): Promise<SemanticQueryResultItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/memory/query`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) throw new Error("Failed to query semantic memory");
    return res.json();
  }

  // --- Productivity & Developer Tooling Methods ---

  async getTasks(status?: string, priority?: string): Promise<TaskItem[]> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (priority) params.append("priority", priority);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE}/api/v1/productivity/tasks${qs}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch tasks");
    return res.json();
  }

  async createTask(
    title: string,
    description?: string,
    priority: string = "medium",
    dueDate?: string
  ): Promise<TaskItem> {
    const res = await fetch(`${API_BASE}/api/v1/productivity/tasks`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        title,
        description,
        priority,
        due_date: dueDate,
      }),
    });
    if (!res.ok) throw new Error("Failed to create task");
    return res.json();
  }

  async updateTask(
    taskId: string,
    updates: Partial<{ title: string; description: string; status: string; priority: string }>
  ): Promise<TaskItem> {
    const res = await fetch(`${API_BASE}/api/v1/productivity/tasks/${taskId}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update task");
    return res.json();
  }

  async deleteTask(taskId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/productivity/tasks/${taskId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete task");
  }

  async getReminders(): Promise<ReminderItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/productivity/reminders`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch reminders");
    return res.json();
  }

  async createReminder(
    message: string,
    triggerAt: string,
    taskId?: string
  ): Promise<ReminderItem> {
    const res = await fetch(`${API_BASE}/api/v1/productivity/reminders`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        message,
        trigger_at: triggerAt,
        task_id: taskId,
      }),
    });
    if (!res.ok) throw new Error("Failed to create reminder");
    return res.json();
  }

  async deleteReminder(reminderId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/productivity/reminders/${reminderId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete reminder");
  }

  async getDailyBriefing(): Promise<DailyBriefingItem> {
    const res = await fetch(`${API_BASE}/api/v1/productivity/daily-summary`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch daily briefing");
    return res.json();
  }

  async inspectGitStatus(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/actions/execute`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        tool_name: "git_status_inspect",
        parameters: { repo_path: "." },
      }),
    });
    if (!res.ok) throw new Error("Failed to inspect git status");
    return res.json();
  }

  async inspectDirectoryTree(maxDepth: number = 3): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/actions/execute`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        tool_name: "directory_tree_inspect",
        parameters: { root_dir: ".", max_depth: maxDepth },
      }),
    });
    if (!res.ok) throw new Error("Failed to inspect directory tree");
    return res.json();
  }

  async streamChat(
    messages: { role: string; content: string }[],
    conversationId: string | null,
    onStart: (convId: string, msgId: string, model: string) => void,
    onToken: (token: string) => void,
    onDone: (convId: string) => void,
    onError: (error: string) => void
  ) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          conversation_id: conversationId,
          messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat stream request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body reader available");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6);
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);
              if (event.type === "start") {
                onStart(event.conversation_id, event.message_id, event.model);
              } else if (event.type === "token") {
                onToken(event.content);
              } else if (event.type === "done") {
                onDone(event.conversation_id);
              } else if (event.type === "error") {
                onError(event.error);
              }
            } catch (err) {
              console.error("SSE parse error:", err, dataStr);
            }
          }
        }
      }
    } catch (e: any) {
      onError(e.message || "Network error during stream");
    }
  }
}

export const api = new ApiClient();
