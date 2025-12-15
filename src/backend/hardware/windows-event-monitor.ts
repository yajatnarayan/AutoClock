/**
 * Windows Event Log Monitor
 * Monitors for GPU driver resets, crashes, and system events
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { logger } from '../utils/production-logger';

const execAsync = promisify(exec);

export interface WindowsEvent {
  timestamp: number;
  level: 'Information' | 'Warning' | 'Error' | 'Critical';
  source: string;
  eventId: number;
  message: string;
}

export interface DriverEvent extends WindowsEvent {
  driverReset: boolean;
  displayRecovery: boolean;
}

/**
 * Monitor Windows Event Log for GPU-related events
 */
export class WindowsEventMonitor extends EventEmitter {
  private monitorInterval?: NodeJS.Timeout;
  private lastCheckTime: number;
  private isMonitoring: boolean = false;

  constructor() {
    super();
    this.lastCheckTime = Date.now();
  }

  /**
   * Start monitoring
   */
  start(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      logger.warn('EventMonitor', 'Already monitoring');
      return;
    }

    this.isMonitoring = true;
    this.lastCheckTime = Date.now();

    logger.info('EventMonitor', 'Starting event monitoring', { intervalMs });

    this.monitorInterval = setInterval(async () => {
      await this.checkForEvents();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    logger.info('EventMonitor', 'Stopped event monitoring');
  }

  /**
   * Check for new events
   */
  private async checkForEvents(): Promise<void> {
    try {
      // Check for display driver events
      const driverEvents = await this.queryDisplayDriverEvents();

      for (const event of driverEvents) {
        if (event.timestamp > this.lastCheckTime) {
          this.emit('driver-event', event);

          if (event.driverReset || event.displayRecovery) {
            this.emit('driver-reset', event);
            logger.error('EventMonitor', 'Driver reset detected', event);
          }
        }
      }

      // Check for application crashes
      const crashEvents = await this.queryApplicationCrashes();

      for (const event of crashEvents) {
        if (event.timestamp > this.lastCheckTime) {
          this.emit('application-crash', event);
          logger.error('EventMonitor', 'Application crash detected', event);
        }
      }

      this.lastCheckTime = Date.now();
    } catch (error) {
      logger.error('EventMonitor', 'Failed to check events', error);
    }
  }

  /**
   * Query Windows Event Log for display driver events
   */
  private async queryDisplayDriverEvents(): Promise<DriverEvent[]> {
    try {
      // Query System log for display driver events (Event ID 4101 = driver reset/recovery)
      const query = `Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Display'; StartTime=(Get-Date).AddMinutes(-1)} -MaxEvents 10 -ErrorAction SilentlyContinue | Select-Object TimeCreated, Level, Id, Message | ConvertTo-Json`;

      const { stdout } = await execAsync(
        `powershell -Command "${query}"`,
        { timeout: 5000 }
      );

      if (!stdout || stdout.trim() === '') {
        return [];
      }

      const events = JSON.parse(stdout);
      const eventArray = Array.isArray(events) ? events : [events];

      return eventArray.map(e => ({
        timestamp: new Date(e.TimeCreated).getTime(),
        level: this.getLevelName(e.Level),
        source: 'Display',
        eventId: e.Id,
        message: e.Message || '',
        driverReset: e.Id === 4101 || e.Message?.includes('driver reset'),
        displayRecovery: e.Message?.includes('display driver stopped responding'),
      }));
    } catch (error) {
      // No events found or error - return empty array
      return [];
    }
  }

  /**
   * Query for application crashes
   */
  private async queryApplicationCrashes(): Promise<WindowsEvent[]> {
    try {
      const query = `Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2; StartTime=(Get-Date).AddMinutes(-1)} -MaxEvents 10 -ErrorAction SilentlyContinue | Select-Object TimeCreated, Level, ProviderName, Id, Message | ConvertTo-Json`;

      const { stdout } = await execAsync(
        `powershell -Command "${query}"`,
        { timeout: 5000 }
      );

      if (!stdout || stdout.trim() === '') {
        return [];
      }

      const events = JSON.parse(stdout);
      const eventArray = Array.isArray(events) ? events : [events];

      return eventArray
        .filter(e => e.Id === 1000 || e.Id === 1001) // Application Error events
        .map(e => ({
          timestamp: new Date(e.TimeCreated).getTime(),
          level: this.getLevelName(e.Level),
          source: e.ProviderName || 'Application',
          eventId: e.Id,
          message: e.Message || '',
        }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if a driver reset occurred recently
   */
  async checkDriverReset(withinMinutes: number = 1): Promise<boolean> {
    const events = await this.queryDisplayDriverEvents();
    const cutoffTime = Date.now() - withinMinutes * 60 * 1000;

    return events.some(
      e => e.timestamp > cutoffTime && (e.driverReset || e.displayRecovery)
    );
  }

  /**
   * Check for recent application crashes
   */
  async checkApplicationCrashes(withinMinutes: number = 1): Promise<WindowsEvent[]> {
    const events = await this.queryApplicationCrashes();
    const cutoffTime = Date.now() - withinMinutes * 60 * 1000;

    return events.filter(e => e.timestamp > cutoffTime);
  }

  /**
   * Get event level name from numeric level
   */
  private getLevelName(
    level: number
  ): 'Information' | 'Warning' | 'Error' | 'Critical' {
    switch (level) {
      case 1:
        return 'Critical';
      case 2:
        return 'Error';
      case 3:
        return 'Warning';
      case 4:
      default:
        return 'Information';
    }
  }

  /**
   * Test event log access
   */
  async testAccess(): Promise<boolean> {
    try {
      await execAsync('powershell -Command "Get-WinEvent -ListLog System"', {
        timeout: 3000,
      });
      return true;
    } catch {
      logger.error('EventMonitor', 'No access to Windows Event Log');
      return false;
    }
  }
}
