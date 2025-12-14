/**
 * AutoOC Backend Service
 * Main service entry point and orchestrator
 */

import { EventEmitter } from 'events';
import { NvidiaAPI } from '../hardware/nvidia-api';
import { TelemetryCollector } from '../hardware/telemetry-collector';
import { Optimizer } from '../optimization/optimizer';
import { StabilityValidator } from '../stability/validator';
import { ProfileManager } from '../profiles/profile-manager';
import {
  ServiceConfig,
  ServiceStatus,
  GPUInfo,
  OptimizationMode,
  Profile,
} from '../types';
import { logger } from '../utils/logger';

export class AutoOCService extends EventEmitter {
  private nvapi: NvidiaAPI;
  private telemetry: TelemetryCollector;
  private optimizer: Optimizer;
  private validator: StabilityValidator;
  private profileManager: ProfileManager;
  private config: ServiceConfig;
  private gpuInfo?: GPUInfo;
  private startTime: number;
  private isRunning: boolean;

  constructor(config?: Partial<ServiceConfig>) {
    super();

    // Initialize configuration
    this.config = {
      telemetryInterval: 1000,
      logRetention: 7,
      autoStartOptimization: false,
      enableLogging: true,
      safetyChecks: {
        maxTemperature: 90,
        maxPowerDraw: 999,
        enableRollback: true,
        rollbackThreshold: 95,
      },
      ...config,
    };

    // Initialize components
    this.nvapi = new NvidiaAPI();
    this.telemetry = new TelemetryCollector(this.config.telemetryInterval);
    this.validator = new StabilityValidator(this.telemetry);
    this.optimizer = new Optimizer(this.nvapi, this.telemetry, this.validator);
    this.profileManager = new ProfileManager('./profiles', this.nvapi);

    this.startTime = Date.now();
    this.isRunning = false;

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AutoOCService', 'Service already running');
      return;
    }

    logger.info('AutoOCService', 'Starting AutoOC service');

    try {
      // Detect GPU hardware
      this.gpuInfo = await this.nvapi.detectGPU();
      logger.info('AutoOCService', 'GPU detected', this.gpuInfo);

      // Ensure default profile exists
      this.profileManager.ensureDefaultProfile();

      // Start telemetry collection
      this.telemetry.start();

      // Set known-good configuration
      const defaultProfile = this.profileManager.getProfile('default');
      if (defaultProfile) {
        this.validator.setKnownGoodConfig(defaultProfile.configuration);
      }

      // Apply active profile if exists
      const activeProfile = this.profileManager.getActiveProfile();
      if (activeProfile && activeProfile.id !== 'default') {
        await this.profileManager.applyProfile(activeProfile.id);
      }

      this.isRunning = true;
      this.emit('started');

      logger.info('AutoOCService', 'Service started successfully');
    } catch (error) {
      logger.error('AutoOCService', 'Failed to start service', error);
      throw error;
    }
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('AutoOCService', 'Stopping AutoOC service');

    // Stop telemetry
    this.telemetry.stop();

    // Reset to default profile
    try {
      await this.profileManager.applyProfile('default');
    } catch (error) {
      logger.error('AutoOCService', 'Failed to reset to default profile', error);
    }

    this.isRunning = false;
    this.emit('stopped');

    logger.info('AutoOCService', 'Service stopped');
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      running: this.isRunning,
      version: '0.1.0',
      uptime: (Date.now() - this.startTime) / 1000,
      activeProfile: this.profileManager.getActiveProfile()?.id,
      optimizationInProgress: this.optimizer.isRunning(),
    };
  }

  /**
   * Get GPU information
   */
  getGPUInfo(): GPUInfo | undefined {
    return this.gpuInfo;
  }

  /**
   * Run optimization
   */
  async runOptimization(mode: OptimizationMode): Promise<Profile> {
    if (!this.isRunning) {
      throw new Error('Service not running');
    }

    logger.info('AutoOCService', 'Starting optimization', { mode });

    try {
      // Run optimization
      const config = await this.optimizer.optimize(mode);

      // Create profile from optimized configuration
      const profile = this.profileManager.createProfile(
        `Optimized ${mode}`,
        `Auto-optimized profile for ${mode} mode`,
        config,
        mode
      );

      // Apply the profile
      await this.profileManager.applyProfile(profile.id);

      logger.info('AutoOCService', 'Optimization completed', { profileId: profile.id });
      this.emit('optimization-complete', profile);

      return profile;
    } catch (error) {
      logger.error('AutoOCService', 'Optimization failed', error);
      this.emit('optimization-failed', error);
      throw error;
    }
  }

  /**
   * Get profile manager
   */
  getProfileManager(): ProfileManager {
    return this.profileManager;
  }

  /**
   * Get telemetry collector
   */
  getTelemetryCollector(): TelemetryCollector {
    return this.telemetry;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Forward telemetry events
    this.telemetry.on('telemetry', (data) => {
      this.emit('telemetry', data);
    });

    // Forward thermal warnings
    this.telemetry.on('thermal-throttle', (data) => {
      logger.warn('AutoOCService', 'Thermal throttle detected');
      this.emit('thermal-warning', data);

      // Auto-rollback if enabled
      if (this.config.safetyChecks.enableRollback) {
        this.handleEmergencyRollback('Thermal throttling detected');
      }
    });

    // Forward power warnings
    this.telemetry.on('power-throttle', (data) => {
      logger.warn('AutoOCService', 'Power throttle detected');
      this.emit('power-warning', data);
    });

    // Forward optimization progress
    this.optimizer.on('progress', (progress) => {
      this.emit('optimization-progress', progress);
    });

    // Handle high temperature
    this.telemetry.on('high-temperature', (data) => {
      if (data.temperature >= this.config.safetyChecks.rollbackThreshold) {
        logger.error('AutoOCService', 'Critical temperature reached', {
          temperature: data.temperature,
        });
        this.handleEmergencyRollback(`Critical temperature: ${data.temperature}°C`);
      }
    });
  }

  /**
   * Handle emergency rollback to safe settings
   */
  private async handleEmergencyRollback(reason: string): Promise<void> {
    logger.warn('AutoOCService', 'Emergency rollback initiated', { reason });

    try {
      await this.validator.rollback();
      await this.profileManager.applyProfile('default');
      this.emit('emergency-rollback', reason);
    } catch (error) {
      logger.error('AutoOCService', 'Emergency rollback failed', error);
      this.emit('critical-error', error);
    }
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...config };

    // Update telemetry interval if changed
    if (config.telemetryInterval) {
      this.telemetry.setInterval(config.telemetryInterval);
    }

    logger.info('AutoOCService', 'Configuration updated', config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ServiceConfig {
    return { ...this.config };
  }
}

// Service singleton instance
let serviceInstance: AutoOCService | null = null;

/**
 * Get or create service instance
 */
export function getService(config?: Partial<ServiceConfig>): AutoOCService {
  if (!serviceInstance) {
    serviceInstance = new AutoOCService(config);
  }
  return serviceInstance;
}

/**
 * Main entry point when run as a service
 */
if (require.main === module) {
  const service = getService();

  service.start().then(() => {
    logger.info('Main', 'AutoOC service started');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Main', 'Received SIGINT, shutting down');
      await service.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Main', 'Received SIGTERM, shutting down');
      await service.stop();
      process.exit(0);
    });
  }).catch((error) => {
    logger.error('Main', 'Failed to start service', error);
    process.exit(1);
  });
}
