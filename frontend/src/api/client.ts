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
    if (!res.ok) {
      throw new Error(`Health check failed: ${res.statusText}`);
    }
    return res.json();
  }

  async getTelemetry(): Promise<DetailedTelemetry> {
    const res = await fetch(`${API_BASE}/api/v1/system/telemetry`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Telemetry request failed: ${res.statusText}`);
    }
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
