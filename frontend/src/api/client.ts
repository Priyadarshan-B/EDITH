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
