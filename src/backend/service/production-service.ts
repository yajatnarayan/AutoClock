/**
 * AutoOC Production Service
 * Complete integration of all components with WebSocket API
 */

import { EventEmitter } from 'events';
import { NvidiaGPUInterface } from '../hardware/nvidia-interface';
import { TelemetryService } from '../hardware/telemetry-service';
import { ProductionOptimizer } from '../optimization/production-optimizer';
import { StabilityEngine } from '../stability/stability-engine';
import { ProductionProfileManager } from '../profiles/production-profile-manager';
import { AutoOCWebSocketServer } from './websocket-server';
import {
  ServiceConfig,
  ServiceStatus,
  GPUInfo,
  OptimizationMode,
} from '../types';
import { logger } from '../utils/production-logger';

type Responder = (data: unknown) => void;
type ErrorResponder = (error: string) => void;

/**
 * Main AutoOC Service - Production Implementation
 */
export class AutoOCProductionService extends EventEmitter {
  private gpuInterface: NvidiaGPUInterface;
  private telemetry: TelemetryService;
  private optimizer: ProductionOptimizer;
  private stability: StabilityEngine;
  private profileManager: ProductionProfileManager;
  private wsServer: AutoOCWebSocketServer;
  private config: ServiceConfig;
  private gpuInfo?: GPUInfo;
  private startTime: number;
  private isRunning: boolean = false;

  constructor(config?: Partial<ServiceConfig>) {
    super();

    this.config = {
      telemetryInterval: 1000,
      logRetention: 7,
      autoStartOptimization: false,
      enableLogging: true,
      safetyChecks: {
        maxTemperature: 95,
        maxPowerDraw: 999,
        enableRollback: true,
        rollbackThreshold: 95,
      },
      ...config,
    };

    this.startTime = Date.now();

    // Initialize components (will be fully initialized in start())
    this.gpuInterface = new NvidiaGPUInterface(0);
    this.telemetry = new TelemetryService(this.gpuInterface, this.config.telemetryInterval);
    this.stability = new StabilityEngine(this.telemetry, this.gpuInterface);
    this.optimizer = new ProductionOptimizer(this.gpuInterface, this.telemetry, this.stability);
    this.profileManager = new ProductionProfileManager(this.gpuInterface);
    this.wsServer = new AutoOCWebSocketServer(8080);

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

    logger.info('AutoOCService', 'Starting AutoOC Production Service');

    try {
      // 1. Initialize GPU interface
      await this.gpuInterface.initialize();

      // 2. Detect GPU hardware
      this.gpuInfo = await this.gpuInterface.detectGPU();
      logger.info('AutoOCService', 'GPU detected', this.gpuInfo);

      // 3. Check privileges and capabilities
      const hasPrivileges = await this.gpuInterface.checkPrivileges();
      if (!hasPrivileges) {
        throw new Error('Administrator privileges required');
      }

      const supportsOC = await this.gpuInterface.checkOverclockSupport();
      if (!supportsOC) {
        logger.warn('AutoOCService', 'GPU may not support overclocking');
      }

      // 4. Ensure default profile exists
      await this.profileManager.ensureDefaultProfile();

      // 5. Start telemetry collection
      this.telemetry.start();

      // 6. Set known-good configuration for rollback
      const defaultProfile = this.profileManager.getKnownGoodProfile();
      if (defaultProfile) {
        this.stability.setKnownGoodConfig(defaultProfile.configuration);
      }

      // 7. Apply active profile if exists
      const activeProfile = this.profileManager.getActiveProfile();
      if (activeProfile && activeProfile.id !== 'default') {
        await this.profileManager.applyProfile(activeProfile.id);
      } else if (defaultProfile) {
        await this.profileManager.applyProfile(defaultProfile.id);
      }

      // 8. Start WebSocket server
      await this.wsServer.start();
      this.setupWebSocketHandlers();

      this.isRunning = true;
      this.emit('started');

      logger.info('AutoOCService', 'Service started successfully', {
        gpu: this.gpuInfo.name,
        wsPort: 8080,
      });
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

    try {
      // Stop WebSocket server
      await this.wsServer.stop();

      // Stop telemetry
      this.telemetry.stop();

      // Stop stability monitoring
      this.stability.shutdown();

      // Reset to default profile
      const defaultProfile = this.profileManager.getKnownGoodProfile();
      if (defaultProfile) {
        await this.profileManager.applyProfile(defaultProfile.id);
      }

      // Shutdown GPU interface
      await this.gpuInterface.shutdown();

      this.isRunning = false;
      this.emit('stopped');

      logger.info('AutoOCService', 'Service stopped');
    } catch (error) {
      logger.error('AutoOCService', 'Error during shutdown', error);
    }
  }

  /**
   * Setup WebSocket command handlers
   */
  private setupWebSocketHandlers(): void {
    this.wsServer.on('command', async ({ ws: _ws, message, respond, respondError }) => {
      try {
        logger.debug('AutoOCService', 'Processing command', { command: message.command });

        switch (message.command) {
          case 'get-status':
            respond(this.getStatus());
            break;

          case 'get-gpu-info':
            respond(this.getGPUInfo());
            break;

          case 'get-telemetry':
            respond(this.telemetry.getLatest());
            break;

          case 'start-optimization':
            await this.handleStartOptimization(message.data?.mode, respond, respondError);
            break;

          case 'get-profiles':
            respond(this.profileManager.getAllProfiles());
            break;

          case 'get-active-profile':
            respond(this.profileManager.getActiveProfile() || null);
            break;

          case 'apply-profile':
            await this.handleApplyProfile(message.data?.profileId, respond, respondError);
            break;

          case 'delete-profile':
            await this.handleDeleteProfile(message.data?.profileId, respond, respondError);
            break;

          case 'rename-profile':
            await this.handleRenameProfile(
              message.data?.profileId,
              message.data?.newName,
              respond,
              respondError
            );
            break;

          case 'export-profile':
            await this.handleExportProfile(message.data?.profileId, respond, respondError);
            break;

          case 'import-profile':
            await this.handleImportProfile(message.data?.jsonString, respond, respondError);
            break;

          default:
            respondError(`Unknown command: ${message.command}`);
        }
      } catch (error: any) {
        logger.error('AutoOCService', 'Command handler error', error);
        respondError(error.message || 'Internal server error');
      }
    });
  }

  /**
   * Handle start optimization command
   */
  private async handleStartOptimization(
    mode: unknown,
    respond: Responder,
    respondError: ErrorResponder
  ): Promise<void> {
    if (typeof mode !== 'string' || !Object.values(OptimizationMode).includes(mode as OptimizationMode)) {
      respondError('Invalid optimization mode');
      return;
    }

    if (this.optimizer.isRunning()) {
      respondError('Optimization already in progress');
      return;
    }

    // SAFETY CHECK: Verify GPU temperature is safe before starting
    try {
      const currentTelemetry = await this.gpuInterface.getTelemetry();

      if (currentTelemetry.temperature > 65) {
        respondError(
          `GPU temperature too high for optimization: ${currentTelemetry.temperature}°C. ` +
          `Please wait for GPU to cool below 65°C before starting optimization.`
        );
        logger.warn('AutoOCService', 'Optimization blocked - GPU too hot', {
          temperature: currentTelemetry.temperature,
        });
        return;
      }

      logger.info('AutoOCService', 'Temperature check passed', {
        temperature: currentTelemetry.temperature,
      });
    } catch (error) {
      logger.error('AutoOCService', 'Failed to check GPU temperature', error);
      respondError('Failed to check GPU temperature before optimization');
      return;
    }

    // Respond immediately that optimization has started
    respond({ status: 'started', mode });

    try {
      // Run optimization asynchronously
      const config = await this.optimizer.optimize(mode as OptimizationMode);

      // Create profile from optimized configuration
      const profile = this.profileManager.createProfile(
        `Optimized ${mode as OptimizationMode}`,
        `Auto-optimized profile for ${mode as OptimizationMode} mode`,
        config,
        mode as OptimizationMode
      );

      // Apply the profile
      await this.profileManager.applyProfile(profile.id);

      // Broadcast completion event
      this.wsServer.broadcast({
        type: 'optimization-complete',
        data: profile,
      });

      logger.info('AutoOCService', 'Optimization completed', { profileId: profile.id });
    } catch (error: any) {
      logger.error('AutoOCService', 'Optimization failed', error);

      // Broadcast failure event
      this.wsServer.broadcast({
        type: 'optimization-failed',
        data: { error: error.message },
      });
    }
  }

  /**
   * Handle apply profile command
   */
  private async handleApplyProfile(
    profileId: unknown,
    respond: Responder,
    respondError: ErrorResponder
  ): Promise<void> {
    if (typeof profileId !== 'string' || profileId.length === 0) {
      respondError('Profile ID required');
      return;
    }

    try {
      await this.profileManager.applyProfile(profileId);
      respond({ success: true });
    } catch (error: any) {
      respondError(error.message);
    }
  }

  /**
   * Handle delete profile command
   */
  private async handleDeleteProfile(
    profileId: unknown,
    respond: Responder,
    respondError: ErrorResponder
  ): Promise<void> {
    if (typeof profileId !== 'string' || profileId.length === 0) {
      respondError('Profile ID required');
      return;
    }

    try {
      this.profileManager.deleteProfile(profileId);
      respond({ success: true });
    } catch (error: any) {
      respondError(error.message);
    }
  }

  /**
   * Handle rename profile command
   */
  private async handleRenameProfile(
    profileId: unknown,
    newName: unknown,
    respond: Responder,
    respondError: ErrorResponder
  ): Promise<void> {
    if (typeof profileId !== 'string' || typeof newName !== 'string' || newName.length === 0) {
      respondError('Profile ID and new name required');
      return;
    }

    try {
      const profile = this.profileManager.updateProfile(profileId, { name: newName });
      respond(profile);
    } catch (error: any) {
      respondError(error.message);
    }
  }

  /**
   * Handle export profile command
   */
  private async handleExportProfile(
    profileId: unknown,
    respond: Responder,
    respondError: ErrorResponder
  ): Promise<void> {
    if (typeof profileId !== 'string' || profileId.length === 0) {
      respondError('Profile ID required');
      return;
    }

    try {
      const json = this.profileManager.exportProfile(profileId);
      respond({ json });
    } catch (error: any) {
      respondError(error.message);
    }
  }

  /**
   * Handle import profile command
   */
  private async handleImportProfile(
    jsonString: unknown,
    respond: Responder,
    respondError: ErrorResponder
  ): Promise<void> {
    if (typeof jsonString !== 'string' || jsonString.length === 0) {
      respondError('Profile JSON required');
      return;
    }

    try {
      const profile = this.profileManager.importProfile(jsonString);
      respond(profile);
    } catch (error: any) {
      respondError(error.message);
    }
  }

  /**
   * Setup event listeners for telemetry and optimization
   */
  private setupEventListeners(): void {
    // Forward telemetry events to WebSocket clients
    this.telemetry.on('telemetry', (data) => {
      this.wsServer.broadcast({
        type: 'telemetry',
        data,
      });
    });

    // Forward thermal warnings
    this.telemetry.on('thermal-throttle', (data) => {
      logger.warn('AutoOCService', 'Thermal throttle detected');
      this.wsServer.broadcast({
        type: 'thermal-warning',
        data,
      });
    });

    // Forward power warnings
    this.telemetry.on('power-throttle', (data) => {
      logger.warn('AutoOCService', 'Power throttle detected');
      this.wsServer.broadcast({
        type: 'power-warning',
        data,
      });
    });

    // Critical temperature - emergency rollback
    this.telemetry.on('critical-temperature', async (data) => {
      logger.error('AutoOCService', 'CRITICAL TEMPERATURE - Emergency rollback', {
        temperature: data.temperature,
      });

      this.wsServer.broadcast({
        type: 'emergency-rollback',
        data: { reason: `Critical temperature: ${data.temperature}°C` },
      });

      // Emergency rollback
      await this.handleEmergencyRollback(`Critical temperature: ${data.temperature}°C`);
    });

    // Forward optimization progress
    this.optimizer.on('progress', (progress) => {
      this.wsServer.broadcast({
        type: 'optimization-progress',
        data: progress,
      });
    });
  }

  /**
   * Handle emergency rollback
   */
  private async handleEmergencyRollback(reason: string): Promise<void> {
    logger.warn('AutoOCService', 'Emergency rollback initiated', { reason });

    try {
      await this.stability.rollback();

      const defaultProfile = this.profileManager.getKnownGoodProfile();
      if (defaultProfile) {
        await this.profileManager.applyProfile(defaultProfile.id);
      }

      this.emit('emergency-rollback', reason);
    } catch (error) {
      logger.error('AutoOCService', 'Emergency rollback failed', error);
      this.emit('critical-error', error);
    }
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
   * Update service configuration
   */
  updateConfig(config: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...config };

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

/**
 * Service singleton instance
 */
let serviceInstance: AutoOCProductionService | null = null;

/**
 * Get or create service instance
 */
export function getService(config?: Partial<ServiceConfig>): AutoOCProductionService {
  if (!serviceInstance) {
    serviceInstance = new AutoOCProductionService(config);
  }
  return serviceInstance;
}

/**
 * Graceful shutdown handler
 * CRITICAL: Ensures GPU is reset to safe state on service termination
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.warn('AutoOCService', `Received ${signal} - Initiating graceful shutdown`);

  try {
    if (serviceInstance) {
      logger.info('AutoOCService', 'Stopping service and resetting GPU to safe state');

      // Stop the service (this will reset GPU to stock)
      await serviceInstance.stop();

      logger.info('AutoOCService', 'Graceful shutdown complete');
    }
  } catch (error) {
    logger.error('AutoOCService', 'Error during graceful shutdown', error);
  } finally {
    // Force exit after shutdown attempt
    process.exit(0);
  }
}

/**
 * Register shutdown handlers
 * This ensures GPU is always reset to stock settings on exit
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught exceptions - emergency GPU reset
process.on('uncaughtException', async (error) => {
  logger.error('AutoOCService', 'UNCAUGHT EXCEPTION - Emergency shutdown', error);

  try {
    if (serviceInstance) {
      // Emergency rollback
      const profileManager = (serviceInstance as any).profileManager;
      const knownGood = profileManager?.getKnownGoodProfile();

      if (knownGood) {
        logger.warn('AutoOCService', 'Applying known-good profile before crash');
        await profileManager.applyProfile(knownGood.id);
      }
    }
  } catch (rollbackError) {
    logger.error('AutoOCService', 'Emergency rollback failed', rollbackError);
  } finally {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('AutoOCService', 'UNHANDLED PROMISE REJECTION', {
    reason,
    promise,
  });

  // Don't exit on unhandled rejection, but log it
  // The service should continue running
});

/**
 * Main entry point when run as a service
 */
if (require.main === module) {
  const service = getService();

  service.start().then(() => {
    logger.info('Main', 'AutoOC Production Service started successfully');
    console.log('\n✅ AutoOC Service is running');
    console.log('📡 WebSocket server: ws://localhost:8080');
    console.log('🎮 GPU:', service.getGPUInfo()?.name || 'Unknown');
    console.log('\nPress Ctrl+C to stop\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down...');
      await service.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Shutting down...');
      await service.stop();
      process.exit(0);
    });
  }).catch((error) => {
    logger.error('Main', 'Failed to start service', error);
    console.error('\n❌ Failed to start AutoOC service:');
    console.error(error.message);
    console.error('\nPlease check:');
    console.error('- NVIDIA drivers are installed (527+)');
    console.error('- nvidia-smi is available');
    console.error('- Running with administrator privileges');
    process.exit(1);
  });
}
