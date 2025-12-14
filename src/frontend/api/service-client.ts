/**
 * Frontend API client for communicating with backend service
 */

import { EventEmitter } from 'events';
import {
  GPUInfo,
  GPUTelemetry,
  Profile,
  OptimizationMode,
  OptimizationProgress,
  ServiceStatus,
} from '../../backend/types';

export class ServiceClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(private serverUrl: string = 'ws://localhost:8080') {
    super();
  }

  /**
   * Connect to backend service
   */
  connect(): void {
    this.ws = new WebSocket(this.serverUrl);

    this.ws.onopen = () => {
      console.log('Connected to AutoOC service');
      this.emit('connected');

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from AutoOC service');
      this.emit('disconnected');
      this.scheduleReconnect();
    };
  }

  /**
   * Disconnect from service
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'telemetry':
        this.emit('telemetry', message.data as GPUTelemetry);
        break;
      case 'optimization-progress':
        this.emit('optimization-progress', message.data as OptimizationProgress);
        break;
      case 'optimization-complete':
        this.emit('optimization-complete', message.data as Profile);
        break;
      case 'optimization-failed':
        this.emit('optimization-failed', message.data);
        break;
      case 'thermal-warning':
        this.emit('thermal-warning', message.data);
        break;
      case 'power-warning':
        this.emit('power-warning', message.data);
        break;
      case 'emergency-rollback':
        this.emit('emergency-rollback', message.data);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Send command to service
   */
  private send(command: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to service'));
        return;
      }

      const id = Math.random().toString(36).substring(7);
      const message = { id, command, data };

      const handler = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.id === id) {
          this.ws!.removeEventListener('message', handler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        }
      };

      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<ServiceStatus> {
    return this.send('get-status');
  }

  /**
   * Get GPU information
   */
  async getGPUInfo(): Promise<GPUInfo> {
    return this.send('get-gpu-info');
  }

  /**
   * Get latest telemetry
   */
  async getTelemetry(): Promise<GPUTelemetry> {
    return this.send('get-telemetry');
  }

  /**
   * Start optimization
   */
  async startOptimization(mode: OptimizationMode): Promise<void> {
    return this.send('start-optimization', { mode });
  }

  /**
   * Get all profiles
   */
  async getProfiles(): Promise<Profile[]> {
    return this.send('get-profiles');
  }

  /**
   * Get active profile
   */
  async getActiveProfile(): Promise<Profile | null> {
    return this.send('get-active-profile');
  }

  /**
   * Apply profile
   */
  async applyProfile(profileId: string): Promise<void> {
    return this.send('apply-profile', { profileId });
  }

  /**
   * Delete profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    return this.send('delete-profile', { profileId });
  }

  /**
   * Rename profile
   */
  async renameProfile(profileId: string, newName: string): Promise<void> {
    return this.send('rename-profile', { profileId, newName });
  }

  /**
   * Export profile
   */
  async exportProfile(profileId: string): Promise<string> {
    return this.send('export-profile', { profileId });
  }

  /**
   * Import profile
   */
  async importProfile(jsonString: string): Promise<Profile> {
    return this.send('import-profile', { jsonString });
  }
}
