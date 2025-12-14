/**
 * Telemetry collection service
 * Continuous monitoring of GPU metrics
 */

import { EventEmitter } from 'events';
import { NvidiaAPI } from './nvidia-api';
import { GPUTelemetry } from '../types';
import { logger } from '../utils/logger';

export class TelemetryCollector extends EventEmitter {
  private nvapi: NvidiaAPI;
  private interval: number;
  private isCollecting: boolean;
  private collectionTimer?: NodeJS.Timeout;
  private telemetryHistory: GPUTelemetry[];
  private maxHistorySize: number;

  constructor(interval: number = 1000, maxHistorySize: number = 3600) {
    super();
    this.nvapi = new NvidiaAPI();
    this.interval = interval;
    this.isCollecting = false;
    this.telemetryHistory = [];
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Start collecting telemetry
   */
  start(): void {
    if (this.isCollecting) {
      logger.warn('TelemetryCollector', 'Already collecting telemetry');
      return;
    }

    this.isCollecting = true;
    logger.info('TelemetryCollector', 'Starting telemetry collection', { interval: this.interval });

    this.collectionTimer = setInterval(async () => {
      await this.collect();
    }, this.interval);
  }

  /**
   * Stop collecting telemetry
   */
  stop(): void {
    if (!this.isCollecting) {
      return;
    }

    this.isCollecting = false;

    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }

    logger.info('TelemetryCollector', 'Stopped telemetry collection');
  }

  /**
   * Collect a single telemetry sample
   */
  private async collect(): Promise<void> {
    try {
      const telemetry = await this.nvapi.getTelemetry();

      // Add to history
      this.telemetryHistory.push(telemetry);

      // Trim history if needed
      if (this.telemetryHistory.length > this.maxHistorySize) {
        this.telemetryHistory.shift();
      }

      // Emit telemetry event
      this.emit('telemetry', telemetry);

      // Check for issues
      this.checkForIssues(telemetry);
    } catch (error) {
      logger.error('TelemetryCollector', 'Failed to collect telemetry', error);
      this.emit('error', error);
    }
  }

  /**
   * Get latest telemetry
   */
  getLatest(): GPUTelemetry | undefined {
    return this.telemetryHistory[this.telemetryHistory.length - 1];
  }

  /**
   * Get telemetry history
   */
  getHistory(duration?: number): GPUTelemetry[] {
    if (!duration) {
      return [...this.telemetryHistory];
    }

    const cutoff = Date.now() - duration;
    return this.telemetryHistory.filter(t => t.timestamp >= cutoff);
  }

  /**
   * Get average metrics over a time period
   */
  getAverageMetrics(duration: number): {
    avgCoreClock: number;
    avgMemoryClock: number;
    avgPowerDraw: number;
    avgTemperature: number;
    avgUtilization: number;
  } {
    const history = this.getHistory(duration);

    if (history.length === 0) {
      return {
        avgCoreClock: 0,
        avgMemoryClock: 0,
        avgPowerDraw: 0,
        avgTemperature: 0,
        avgUtilization: 0,
      };
    }

    const sum = history.reduce(
      (acc, t) => ({
        coreClock: acc.coreClock + t.coreClock,
        memoryClock: acc.memoryClock + t.memoryClock,
        powerDraw: acc.powerDraw + t.powerDraw,
        temperature: acc.temperature + t.temperature,
        utilization: acc.utilization + t.utilization.gpu,
      }),
      { coreClock: 0, memoryClock: 0, powerDraw: 0, temperature: 0, utilization: 0 }
    );

    const count = history.length;

    return {
      avgCoreClock: sum.coreClock / count,
      avgMemoryClock: sum.memoryClock / count,
      avgPowerDraw: sum.powerDraw / count,
      avgTemperature: sum.temperature / count,
      avgUtilization: sum.utilization / count,
    };
  }

  /**
   * Clear telemetry history
   */
  clearHistory(): void {
    this.telemetryHistory = [];
    logger.info('TelemetryCollector', 'Telemetry history cleared');
  }

  /**
   * Check for thermal or power issues
   */
  private checkForIssues(telemetry: GPUTelemetry): void {
    // Check for thermal throttling
    if (telemetry.throttleReasons.includes('thermal' as any)) {
      logger.warn('TelemetryCollector', 'Thermal throttling detected', {
        temperature: telemetry.temperature,
      });
      this.emit('thermal-throttle', telemetry);
    }

    // Check for power throttling
    if (telemetry.throttleReasons.includes('power' as any)) {
      logger.warn('TelemetryCollector', 'Power throttling detected', {
        powerDraw: telemetry.powerDraw,
      });
      this.emit('power-throttle', telemetry);
    }

    // Check for high temperature
    if (telemetry.temperature > 85) {
      logger.warn('TelemetryCollector', 'High temperature detected', {
        temperature: telemetry.temperature,
      });
      this.emit('high-temperature', telemetry);
    }
  }

  /**
   * Set collection interval
   */
  setInterval(interval: number): void {
    this.interval = interval;

    if (this.isCollecting) {
      this.stop();
      this.start();
    }

    logger.info('TelemetryCollector', 'Collection interval updated', { interval });
  }

  /**
   * Check if currently collecting
   */
  isActive(): boolean {
    return this.isCollecting;
  }
}
