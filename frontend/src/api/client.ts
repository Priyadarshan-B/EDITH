import { DetailedTelemetry, HealthResponse } from "../types";

const API_BASE = "http://127.0.0.1:18420";

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
}

export const api = new ApiClient();
