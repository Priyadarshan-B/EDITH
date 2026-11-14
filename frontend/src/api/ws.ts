type MessageHandler = (data: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: any = null;
  private isExplicitlyClosed = false;

  constructor(url: string = "ws://127.0.0.1:18420/ws/events") {
    this.url = url;
  }

  setToken(token: string) {
    this.token = token;
  }

  connect() {
    this.isExplicitlyClosed = false;
    const fullUrl = this.token ? `${this.url}?token=${encodeURIComponent(this.token)}` : this.url;

    try {
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        this.emit("CONNECTION_STATUS", { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          this.emit(envelope.type, envelope.payload);
        } catch (e) {
          console.error("WS Parse Error:", e);
        }
      };

      this.ws.onclose = () => {
        this.emit("CONNECTION_STATUS", { connected: false });
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error("WS Error:", err);
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  on(type: string, handler: MessageHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: MessageHandler) {
    this.listeners.get(type)?.delete(handler);
  }

  private emit(type: string, data: any) {
    this.listeners.get(type)?.forEach((h) => h(data));
  }

  send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  close() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }
}

export const wsClient = new WebSocketClient();
