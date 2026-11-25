import { DetailedTelemetry, HealthResponse } from "../types";
import { getApiBase } from "./config";

export interface MCPToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface MCPServerInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  command: string;
  args: string[];
  env_keys: string[];
  enabled: boolean;
  status: string;
  error?: string | null;
  setup_hint: string;
  tools: MCPToolSchema[];
}

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

export interface VoicePackInfo {
  id: string;
  name: string;
  locale: string;
  accent: string;
  description: string;
}

export interface VoicePacksResponse {
  active_voice: string;
  rate: number;
  packs: VoicePackInfo[];
}

export interface VirtualMouseStatus {
  enabled: boolean;
  running: boolean;
  camera_index: number;
  sensitivity: number;
  smoothing?: number;
  deadzone?: number;
  scroll_speed?: number;
  drag_enabled?: boolean;
  mirror?: boolean;
  gesture: string;
  preview_available: boolean;
  last_error?: string | null;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  is_active: boolean;
  is_git: boolean;
  is_edith_root?: boolean;
}

export interface WorkspacesResponse {
  projects_root: string;
  edith_root?: string;
  active_workspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
}

export interface AntigravityBuildJob {
  build_id: string;
  prompt: string;
  workspace_path: string;
  status: "running" | "completed" | "failed";
  engine?: string;
  created_at: number;
  completed_at?: number | null;
  events: { type: string; content: string; ts: number }[];
  output_text: string;
  error?: string | null;
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
    const res = await fetch(`${getApiBase()}/health`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  }

  async getTelemetry(): Promise<DetailedTelemetry> {
    const res = await fetch(`${getApiBase()}/api/v1/system/telemetry`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Telemetry request failed: ${res.statusText}`);
    return res.json();
  }

  async getModels(): Promise<AvailableModelsResponse> {
    const res = await fetch(`${getApiBase()}/api/v1/chat/models`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch models");
    return res.json();
  }

  async switchModel(modelName: string, provider?: string): Promise<any> {
    const res = await fetch(`${getApiBase()}/api/v1/chat/models/switch`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ model_name: modelName, provider }),
    });
    if (!res.ok) throw new Error("Failed to switch model");
    return res.json();
  }

  async getConversations(): Promise<ConversationItem[]> {
    const res = await fetch(`${getApiBase()}/api/v1/chat/conversations`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch conversations");
    return res.json();
  }

  async createConversation(title?: string): Promise<ConversationItem> {
    const res = await fetch(`${getApiBase()}/api/v1/chat/conversations`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ title: title || "New Conversation" }),
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    return res.json();
  }

  async getConversationMessages(conversationId: string): Promise<StoredMessage[]> {
    const res = await fetch(`${getApiBase()}/api/v1/chat/conversations/${conversationId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch messages");
    return res.json();
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await fetch(`${getApiBase()}/api/v1/chat/conversations/${conversationId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete conversation");
  }

  // Security & Actions
  async getPendingActions(): Promise<PendingActionItem[]> {
    const res = await fetch(`${getApiBase()}/api/v1/actions/pending`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch pending actions");
    return res.json();
  }

  async authorizeAction(actionId: string): Promise<any> {
    const res = await fetch(`${getApiBase()}/api/v1/actions/authorize/${actionId}`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to authorize action");
    return res.json();
  }

  async denyAction(actionId: string): Promise<any> {
    const res = await fetch(`${getApiBase()}/api/v1/actions/deny/${actionId}`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to deny action");
    return res.json();
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLogItem[]> {
    const res = await fetch(`${getApiBase()}/api/v1/actions/audit?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  }

  async getFacts(category?: string): Promise<UserFactItem[]> {
    const url = category
      ? `${getApiBase()}/api/v1/memory/facts?category=${encodeURIComponent(category)}`
      : `${getApiBase()}/api/v1/memory/facts`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch user facts");
    return res.json();
  }

  async createFact(
    factContent: string,
    category: string = "preference",
    confidence: number = 1.0
  ): Promise<UserFactItem> {
    const res = await fetch(`${getApiBase()}/api/v1/memory/facts`, {
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
    const res = await fetch(`${getApiBase()}/api/v1/memory/facts/${factId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete memory fact");
  }

  async queryMemory(query: string, limit: number = 5): Promise<SemanticQueryResultItem[]> {
    const res = await fetch(`${getApiBase()}/api/v1/memory/query`, {
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
    const res = await fetch(`${getApiBase()}/api/v1/productivity/tasks${qs}`, {
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
    const res = await fetch(`${getApiBase()}/api/v1/productivity/tasks`, {
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
    const res = await fetch(`${getApiBase()}/api/v1/productivity/tasks/${taskId}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update task");
    return res.json();
  }

  async deleteTask(taskId: string): Promise<void> {
    const res = await fetch(`${getApiBase()}/api/v1/productivity/tasks/${taskId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete task");
  }

  async getReminders(): Promise<ReminderItem[]> {
    const res = await fetch(`${getApiBase()}/api/v1/productivity/reminders`, {
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
    const res = await fetch(`${getApiBase()}/api/v1/productivity/reminders`, {
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
    const res = await fetch(`${getApiBase()}/api/v1/productivity/reminders/${reminderId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete reminder");
  }

  async getDailyBriefing(): Promise<DailyBriefingItem> {
    const res = await fetch(`${getApiBase()}/api/v1/productivity/daily-summary`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch daily briefing");
    return res.json();
  }

  async inspectGitStatus(): Promise<any> {
    const res = await fetch(`${getApiBase()}/api/v1/actions/execute`, {
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
    const res = await fetch(`${getApiBase()}/api/v1/actions/execute`, {
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

  async getOperatorProfile(): Promise<{ name: string; title: string }> {
    try {
      const res = await fetch(`${getApiBase()}/api/v1/system/profile`, {
        headers: this.getHeaders(),
      });
      if (res.ok) return res.json();
    } catch {}
    return { name: "Boss", title: "Boss" };
  }

  // --- Continuous Personalization & Training API ---
  async getTrainingStatus(): Promise<{
    enabled: boolean;
    is_training: boolean;
    total_pairs: number;
    last_trained_at: string | null;
    logs: {
      id: string;
      title: string;
      details: string;
      category: string;
      timestamp: string;
    }[];
    patterns?: {
      id: string;
      prompt: string;
      intent_or_tool: string;
      source_mode: string;
      model_used: string;
      learned_summary: string;
      confidence: number;
      timestamp: string;
    }[];
    stats?: {
      total_patterns: number;
      offline_count: number;
      online_count: number;
      tool_count: number;
    };
    how_it_learns?: { step: string; detail: string }[];
  }> {
    const res = await fetch(`${getApiBase()}/api/v1/training/status`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch training status");
    return res.json();
  }

  async toggleContinuousTraining(enabled: boolean): Promise<{ status: string; enabled: boolean }> {
    const res = await fetch(`${getApiBase()}/api/v1/training/toggle`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error("Failed to toggle continuous training");
    return res.json();
  }

  async runPersonalizationNow(): Promise<any> {
    const res = await fetch(`${getApiBase()}/api/v1/training/run`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to run personalization cycle");
    return res.json();
  }

  // --- Database Table Explorer API ---
  async getDatabaseInfo(): Promise<{
    path: string;
    exists: boolean;
    size_bytes: number;
    size_kb: number;
    tables: {
      name: string;
      row_count: number;
      columns: { cid: number; name: string; type: string; pk: boolean }[];
    }[];
  }> {
    const res = await fetch(`${getApiBase()}/api/v1/database/info`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch database information");
    return res.json();
  }

  async getTableData(
    tableName: string,
    limit: number = 25,
    offset: number = 0,
    search?: string,
    filterCol?: string,
    filterVal?: string,
    sortCol?: string,
    sortDir: "asc" | "desc" = "desc"
  ): Promise<{
    table: string;
    total_rows: number;
    limit: number;
    offset: number;
    columns: { cid: number; name: string; type: string; pk: boolean }[];
    rows: Record<string, any>[];
  }> {
    let url = `${getApiBase()}/api/v1/database/table/${tableName}?limit=${limit}&offset=${offset}&sort_dir=${sortDir}`;
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    if (filterCol && filterVal && filterVal.trim()) {
      url += `&filter_col=${encodeURIComponent(filterCol)}&filter_val=${encodeURIComponent(filterVal.trim())}`;
    }
    if (sortCol) {
      url += `&sort_col=${encodeURIComponent(sortCol)}`;
    }
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch rows for table ${tableName}`);
    return res.json();
  }

  async getVoicePacks(): Promise<VoicePacksResponse> {
    const res = await fetch(`${getApiBase()}/api/v1/voice/packs`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch voice packs");
    return res.json();
  }

  async updateVoiceSettings(activeVoice?: string, rate?: number): Promise<{ active_voice: string; rate: number }> {
    const res = await fetch(`${getApiBase()}/api/v1/voice/settings`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ active_voice: activeVoice, rate }),
    });
    if (!res.ok) throw new Error("Failed to update voice settings");
    return res.json();
  }

  async getVirtualMouseStatus(): Promise<VirtualMouseStatus> {
    const res = await fetch(`${getApiBase()}/api/v1/vision/mouse/status`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch virtual mouse status");
    return res.json();
  }

  async toggleVirtualMouse(enabled: boolean, cameraIndex = 0, sensitivity = 1.25): Promise<VirtualMouseStatus> {
    const res = await fetch(`${getApiBase()}/api/v1/vision/mouse/toggle`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ enabled, camera_index: cameraIndex, sensitivity }),
    });
    if (!res.ok) throw new Error("Failed to toggle virtual mouse");
    return res.json();
  }

  async configureVirtualMouse(patch: {
    camera_index?: number;
    sensitivity?: number;
    smoothing?: number;
    deadzone?: number;
    scroll_speed?: number;
    drag_enabled?: boolean;
    mirror?: boolean;
  }): Promise<VirtualMouseStatus> {
    const res = await fetch(`${getApiBase()}/api/v1/vision/mouse/config`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to configure virtual mouse");
    return res.json();
  }

  async getNetworkInfo(): Promise<{ host: string; port: number; local_url: string; lan_ip: string; mobile_url: string }> {
    const res = await fetch(`${getApiBase()}/api/v1/system/network`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch network info");
    return res.json();
  }

  async getBootLogs(limit = 35): Promise<{ backend_ready: boolean; voice_ready: boolean; logs: string[] }> {
    const res = await fetch(`${getApiBase()}/api/v1/system/boot-logs?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch boot logs");
    return res.json();
  }

  async getMCPServers(): Promise<{ servers: MCPServerInfo[] }> {
    const res = await fetch(`${getApiBase()}/api/v1/mcp/servers`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch MCP servers");
    return res.json();
  }

  async toggleMCPServer(serverId: string, enabled: boolean): Promise<MCPServerInfo> {
    const res = await fetch(`${getApiBase()}/api/v1/mcp/servers/${encodeURIComponent(serverId)}/toggle`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to toggle MCP server");
    }
    return res.json();
  }

  async updateMCPEnv(serverId: string, env: Record<string, string>): Promise<MCPServerInfo> {
    const res = await fetch(`${getApiBase()}/api/v1/mcp/servers/${encodeURIComponent(serverId)}/env`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ env }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to update MCP environment variables");
    }
    return res.json();
  }

  async addCustomMCPServer(payload: {
    id: string;
    name: string;
    command: string;
    args: string[];
    category: string;
    description: string;
    env: Record<string, string>;
  }): Promise<MCPServerInfo> {
    const res = await fetch(`${getApiBase()}/api/v1/mcp/servers`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to add custom MCP server");
    }
    return res.json();
  }

  async callMCPTool(
    serverId: string,
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<{ server_id: string; tool_name: string; is_error: boolean; output: string }> {
    const res = await fetch(`${getApiBase()}/api/v1/mcp/tools/call`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ server_id: serverId, tool_name: toolName, arguments: args }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to execute MCP tool");
    }
    return res.json();
  }

  async getWorkspaces(): Promise<WorkspacesResponse> {
    const res = await fetch(`${getApiBase()}/api/v1/workspaces`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch workspaces");
    return res.json();
  }

  async selectWorkspace(path: string, createIfMissing = false): Promise<{ active_workspace: WorkspaceInfo }> {
    const res = await fetch(`${getApiBase()}/api/v1/workspaces/select`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ path, create_if_missing: createIfMissing }),
    });
    if (!res.ok) throw new Error("Failed to select workspace");
    return res.json();
  }

  async browseWorkspaceFolder(): Promise<{ selected: string | null; active_workspace: WorkspaceInfo | null }> {
    const res = await fetch(`${getApiBase()}/api/v1/workspaces/browse`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to open folder picker");
    return res.json();
  }

  async createWorkspace(name: string, template = "empty"): Promise<{ active_workspace: WorkspaceInfo }> {
    const res = await fetch(`${getApiBase()}/api/v1/workspaces/create`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ name, template }),
    });
    if (!res.ok) throw new Error("Failed to create workspace");
    return res.json();
  }

  async openWorkspaceInEditor(path?: string, editor = "antigravity"): Promise<{ opened: boolean; editor: string; path: string }> {
    const res = await fetch(`${getApiBase()}/api/v1/workspaces/open`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ path, editor }),
    });
    if (!res.ok) throw new Error("Failed to open workspace");
    return res.json();
  }

  async startAntigravityBuild(prompt: string, workspacePath?: string): Promise<AntigravityBuildJob> {
    const res = await fetch(`${getApiBase()}/api/v1/antigravity/build`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ prompt, workspace_path: workspacePath }),
    });
    if (!res.ok) throw new Error("Failed to start Antigravity build");
    return res.json();
  }

  async getAntigravityBuilds(): Promise<{ builds: AntigravityBuildJob[] }> {
    const res = await fetch(`${getApiBase()}/api/v1/antigravity/builds`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch Antigravity builds");
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
      const response = await fetch(`${getApiBase()}/api/v1/chat/stream`, {
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
