import { WSMessage } from '../types/telemetry';

export type WSConnectionState = 'connected' | 'disconnected' | 'connecting';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimeout: number | null = null;
  private reconnectInterval = 2000;
  private maxReconnectInterval = 10000;
  private shouldReconnect = true;

  public onMessage: ((msg: WSMessage) => void) | null = null;
  public onStateChange: ((state: WSConnectionState) => void) | null = null;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws`;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldReconnect = true;
    this.updateState('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.updateState('connected');
        this.reconnectInterval = 2000; // Reset backoff on success
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          if (this.onMessage) {
            this.onMessage(data);
          }
        } catch (err) {
          console.error('[WebSocket] Chyba při zpracování zprávy:', err);
        }
      };

      this.ws.onclose = () => {
        this.updateState('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Chyba spojení:', err);
        this.ws?.close();
      };
    } catch (err) {
      this.updateState('disconnected');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateState('disconnected');
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimeout !== null) {
      return;
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectInterval = Math.min(this.reconnectInterval * 1.5, this.maxReconnectInterval);
      this.connect();
    }, this.reconnectInterval);
  }

  private updateState(state: WSConnectionState): void {
    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }
}
