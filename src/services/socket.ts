import { AnswerOption } from '../types';

type MessageHandler = (payload: any) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimeout: any = null;
  private isExplicitlyClosed = false;
  private latency: number = 0;
  private pingInterval: any = null;
  private lastPingSent = 0;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private isConnecting = false;

  // Stored registration info for auto-reconnect
  private currentRole: 'ADMIN' | 'TEAM' | 'DISPLAY' = 'DISPLAY';
  private currentTeamId?: string;
  private isConnected = false;

  constructor() {
    //
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve(this.ws.readyState === WebSocket.OPEN);
        return;
      }

      if (this.isConnecting) {
        resolve(false);
        return;
      }

      this.isConnecting = true;
      this.isExplicitlyClosed = false;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Dynamically resolves to the server hostname & port that served the web app
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        console.log(`[WebSocket] Connecting to ${wsUrl} (attempt ${this.reconnectAttempts + 1})...`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('[WebSocket] Connection established successfully.');
          this.emit('connection_status', { connected: true, latency: this.latency });
          this.startPingPong();

          // Re-join role if reconnecting
          this.join(this.currentRole, this.currentTeamId);
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleIncomingMessage(data);
          } catch (err) {
            console.error('[WebSocket] Failed to parse incoming message:', err);
          }
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          this.isConnected = false;
          this.stopPingPong();
          this.emit('connection_status', { connected: false, code: event.code, reason: event.reason });

          if (!this.isExplicitlyClosed) {
            // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, max 10s
            const delay = Math.min(
              this.maxReconnectDelay,
              1000 * Math.pow(2, Math.min(this.reconnectAttempts, 4))
            );
            this.reconnectAttempts++;
            console.log(`[WebSocket] Disconnected. Scheduling reconnect in ${delay}ms (attempt #${this.reconnectAttempts})...`);

            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
              this.connect();
            }, delay);
          }
        };

        this.ws.onerror = (err) => {
          this.isConnecting = false;
          console.warn('[WebSocket] Connection error:', err);
          this.isConnected = false;
          this.emit('connection_status', { connected: false, error: err });
          resolve(false);
        };
      } catch (err) {
        this.isConnecting = false;
        console.error('[WebSocket] Initialization error:', err);
        this.isConnected = false;
        resolve(false);
      }
    });
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    this.stopPingPong();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  public join(role: 'ADMIN' | 'TEAM' | 'DISPLAY', teamId?: string, forceTakeover: boolean = false) {
    this.currentRole = role;
    this.currentTeamId = teamId;

    const adminToken = sessionStorage.getItem('lan_quiz_admin_token') || localStorage.getItem('lan_quiz_admin_token');

    this.send('JOIN', {
      role,
      team_id: teamId,
      force_takeover: forceTakeover,
      admin_token: role === 'ADMIN' ? adminToken : undefined,
    });
  }

  public submitAnswer(sessionId: string, answer: AnswerOption) {
    this.send('SUBMIT_ANSWER', {
      session_id: sessionId,
      answer,
    });
  }

  public send(type: string, payload: any = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
  }

  private handleIncomingMessage(data: { type: string; payload?: any }) {
    const { type, payload } = data;

    if (type === 'PONG') {
      if (this.lastPingSent > 0) {
        this.latency = Math.max(1, Date.now() - this.lastPingSent);
        this.emit('latency_update', { latency: this.latency });
      }
      return;
    }

    this.emit(type, payload);
  }

  private startPingPong() {
    this.stopPingPong();
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.lastPingSent = Date.now();
        this.send('PING');
      }
    }, 5000);
  }

  private stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Event Listeners
  public on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  public off(event: string, handler: MessageHandler) {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  private emit(event: string, payload: any) {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach((h) => {
        try {
          h(payload);
        } catch (e) {
          console.error(`Error in WS event handler for ${event}:`, e);
        }
      });
    }
  }

  public getLatency(): number {
    return this.latency;
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }
}

export const socket = new SocketService();
