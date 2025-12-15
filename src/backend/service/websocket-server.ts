/**
 * WebSocket Server for AutoOC
 * Real-time communication between backend service and frontend
 */

import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { logger } from '../utils/production-logger';

export interface WSMessage {
  id: string;
  command: string;
  data?: any;
  authToken?: string;
}

export interface WSResponse {
  id: string;
  error?: string;
  data?: any;
}

export interface WSEvent {
  type: string;
  data: any;
}

/**
 * WebSocket Server for backend-frontend communication
 */
export class AutoOCWebSocketServer extends EventEmitter {
  private wss?: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private port: number;
  private isRunning: boolean = false;
  private authToken?: string;

  constructor(port: number = 8080, authToken?: string) {
    super();
    this.port = port;
    this.authToken = authToken ?? process.env.AUTOOC_WS_TOKEN;
  }

  /**
   * Start the WebSocket server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        reject(new Error('WebSocket server already running'));
        return;
      }

      try {
        this.wss = new WebSocketServer({
          port: this.port,
          host: '127.0.0.1', // Only localhost for security
        });

        this.wss.on('listening', () => {
          this.isRunning = true;
          logger.info('WebSocket', `Server started on port ${this.port}`);
          resolve();
        });

        this.wss.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws);
        });

        this.wss.on('error', (error) => {
          logger.error('WebSocket', 'Server error', error);
          reject(error);
        });
      } catch (error) {
        logger.error('WebSocket', 'Failed to start server', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all client connections
      this.clients.forEach(client => {
        client.close();
      });
      this.clients.clear();

      // Close server
      this.wss.close(() => {
        this.isRunning = false;
        logger.info('WebSocket', 'Server stopped');
        resolve();
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = randomUUID();
    this.clients.add(ws);

    logger.info('WebSocket', 'Client connected', { clientId });

    // Setup ping/pong for connection health
    let isAlive = true;
    ws.on('pong', () => {
      isAlive = true;
    });

    const pingInterval = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);
    pingInterval.unref?.();

    // Handle messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await this.handleMessage(ws, message);
      } catch (error: any) {
        logger.error('WebSocket', 'Invalid message received', error);
        this.sendError(ws, 'unknown', 'Invalid message format');
      }
    });

    // Handle close
    ws.on('close', () => {
      clearInterval(pingInterval);
      this.clients.delete(ws);
      logger.info('WebSocket', 'Client disconnected', { clientId });
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket', 'Client error', error);
    });

    // Send welcome message
    this.send(ws, {
      type: 'connected',
      data: { clientId, version: '0.1.0', authRequired: !!this.authToken },
    });
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    logger.debug('WebSocket', 'Received message', {
      id: message.id,
      command: message.command,
    });

    if (this.authToken && message.authToken !== this.authToken) {
      this.sendError(ws, message.id, 'Unauthorized');
      return;
    }

    // Emit command event for service to handle
    this.emit('command', {
      ws,
      message,
      respond: (data: any) => this.sendResponse(ws, message.id, data),
      respondError: (error: string) => this.sendError(ws, message.id, error),
    });
  }

  /**
   * Send response to a specific client
   */
  private sendResponse(ws: WebSocket, id: string, data: any): void {
    const response: WSResponse = { id, data };

    try {
      ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error('WebSocket', 'Failed to send response', error);
    }
  }

  /**
   * Send error response to a specific client
   */
  private sendError(ws: WebSocket, id: string, error: string): void {
    const response: WSResponse = { id, error };

    try {
      ws.send(JSON.stringify(response));
    } catch (err) {
      logger.error('WebSocket', 'Failed to send error', err);
    }
  }

  /**
   * Send event to a specific client
   */
  private send(ws: WebSocket, event: WSEvent): void {
    try {
      ws.send(JSON.stringify(event));
    } catch (error) {
      logger.error('WebSocket', 'Failed to send event', error);
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: WSEvent): void {
    const message = JSON.stringify(event);

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          logger.error('WebSocket', 'Failed to broadcast to client', error);
        }
      }
    });
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if server is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
