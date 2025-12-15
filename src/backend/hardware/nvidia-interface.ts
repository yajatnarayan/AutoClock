/**
 * NVIDIA GPU Interface Implementation
 * Production implementation using real NVML and Windows APIs
 */

import {
  IGPUInterface,
  GPUCapabilities,
  GPULimits,
} from './gpu-interface';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NVMLWrapper } from './nvml-wrapper';
import {
  GPUInfo,
  GPUTelemetry,
  ClockOffset,
  FanCurvePoint,
  ThrottleReason,
} from '../types';
import { logger } from '../utils/production-logger';

const execAsync = promisify(exec);

export class NvidiaGPUInterface extends IGPUInterface {
  private nvml: NVMLWrapper;
  private capabilities?: GPUCapabilities;
  private limits?: GPULimits;
  private baselineClocks?: { graphics: number; memory: number };

  constructor(gpuIndex: number = 0) {
    super(gpuIndex);
    this.nvml = new NVMLWrapper();
  }

  /**
   * Initialize the interface
   */
  async initialize(): Promise<void> {
    await this.nvml.initialize();

    // Cache baseline clocks
    const baseline = await this.nvml.getBaselineClocks(this.gpuIndex);
    this.baselineClocks = {
      graphics: baseline.graphics,
      memory: baseline.memory,
    };

    logger.info('NvidiaGPU', `GPU ${this.gpuIndex} initialized`, {
      baselineClocks: this.baselineClocks,
      baselineSource: baseline.source,
    });
  }

  /**
   * Detect GPU information
   */
  async detectGPU(): Promise<GPUInfo> {
    try {
      const device = await this.nvml.getDeviceByIndex(this.gpuIndex);
      const telemetry = await this.nvml.getTelemetry(this.gpuIndex);
      const driverVersion = await this.nvml.getDriverVersion();

      const gpuInfo: GPUInfo = {
        id: `nvidia-${this.gpuIndex}`,
        name: device.name,
        vendor: 'NVIDIA',
        architecture: this.detectArchitecture(device.name),
        driverVersion,
        vramSize: Math.round(telemetry.memory.total),
        vramType: this.detectVRAMType(device.name),
        busInterface: device.pciInfo.busId,
        powerLimit: {
          default: telemetry.power.default,
          min: telemetry.power.min,
          max: telemetry.power.max,
          current: telemetry.power.limit,
        },
        thermalLimit: 90, // Conservative default
        boost: true,
      };

      logger.info('NvidiaGPU', 'GPU detected', gpuInfo);
      return gpuInfo;
    } catch (error) {
      logger.error('NvidiaGPU', 'Failed to detect GPU', error);
      throw new Error(`Failed to detect NVIDIA GPU: ${error}`);
    }
  }

  /**
   * Get real-time telemetry
   */
  async getTelemetry(): Promise<GPUTelemetry> {
    try {
      const nvmlData = await this.nvml.getTelemetry(this.gpuIndex);

      const telemetry: GPUTelemetry = {
        timestamp: Date.now(),
        coreClock: nvmlData.clocks.graphics,
        memoryClock: nvmlData.clocks.memory,
        powerDraw: nvmlData.power.draw,
        temperature: nvmlData.temperature.gpu,
        hotspotTemperature: nvmlData.temperature.hotspot,
        fanSpeed: nvmlData.fan.speed,
        utilization: {
          gpu: nvmlData.utilization.gpu,
          memory: nvmlData.utilization.memory,
          encoder: nvmlData.utilization.encoder,
          decoder: nvmlData.utilization.decoder,
        },
        throttleReasons: this.parseThrottleReasons(nvmlData.throttle),
        voltage: nvmlData.voltage?.current,
      };

      return telemetry;
    } catch (error) {
      logger.error('NvidiaGPU', 'Failed to get telemetry', error);
      throw error;
    }
  }

  /**
   * Get GPU capabilities
   */
  async getCapabilities(): Promise<GPUCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    const telemetry = await this.nvml.getTelemetry(this.gpuIndex);
    const supportsOC = await this.nvml.supportsOverclocking(this.gpuIndex);

    let supportsPowerLimit = telemetry.power.min > 0;
    if (supportsPowerLimit) {
      try {
        // No-op write to validate permission/support (set current limit to itself).
        await this.nvml.setPowerLimit(this.gpuIndex, telemetry.power.limit);
      } catch {
        supportsPowerLimit = false;
      }
    }

    this.capabilities = {
      supportsClockOffset: supportsOC,
      supportsPowerLimit,
      // Reading fan speed is supported; controlling fan requires NVAPI (not implemented).
      supportsFanControl: false,
      supportsVoltageControl: false, // Requires NVAPIi, not nvidia-smi
      clockOffsetRange: {
        coreMin: -300,
        coreMax: 300,
        memoryMin: -1500,
        memoryMax: 1500,
      },
      powerLimitRange: {
        min: telemetry.power.min,
        max: telemetry.power.max,
        default: telemetry.power.default,
      },
      fanSpeedRange: {
        min: 0,
        max: 100,
      },
    };

    logger.info('NvidiaGPU', 'Capabilities detected', this.capabilities);
    return this.capabilities;
  }

  /**
   * Get GPU limits
   */
  async getLimits(): Promise<GPULimits> {
    if (this.limits) {
      return this.limits;
    }

    const telemetry = await this.nvml.getTelemetry(this.gpuIndex);

    this.limits = {
      maxTemperature: 95, // NVIDIA safe max
      maxPowerDraw: telemetry.power.max,
      thermalThrottleTemp: 83, // Typical thermal throttle
      powerThrottleLimit: telemetry.power.max * 0.95,
    };

    return this.limits;
  }

  /**
   * Apply clock offset
   */
  async applyClockOffset(offset: ClockOffset): Promise<void> {
    try {
      const capabilities = await this.getCapabilities();

      // Validate offsets are within limits
      const coreOffset = Math.max(
        capabilities.clockOffsetRange.coreMin,
        Math.min(capabilities.clockOffsetRange.coreMax, offset.core)
      );
      const memoryOffset = Math.max(
        capabilities.clockOffsetRange.memoryMin,
        Math.min(capabilities.clockOffsetRange.memoryMax, offset.memory)
      );

      // Treat 0/0 as "stock behavior": remove any clock locks.
      if (coreOffset === 0 && memoryOffset === 0) {
        await this.resetClocks();
        return;
      }

      if (!capabilities.supportsClockOffset) {
        throw new Error('Clock control not supported on this GPU/driver');
      }

      // NVML uses absolute clocks, so we add the desired delta to a baseline.
      if (!this.baselineClocks) {
        const baseline = await this.nvml.getBaselineClocks(this.gpuIndex);
        this.baselineClocks = { graphics: baseline.graphics, memory: baseline.memory };
      }

      const targetGraphics = this.baselineClocks.graphics + coreOffset;
      const targetMemory = this.baselineClocks.memory + memoryOffset;

      // Lock only the clocks being tuned; reset locks on the others.
      if (coreOffset !== 0) {
        await this.nvml.lockGPUClocks(
          this.gpuIndex,
          targetGraphics,
          targetGraphics
        );
      } else {
        await this.nvml.resetGPUClocks(this.gpuIndex);
      }

      if (memoryOffset !== 0) {
        await this.nvml.lockMemoryClocks(
          this.gpuIndex,
          targetMemory,
          targetMemory
        );
      } else {
        await this.nvml.resetMemoryClocks(this.gpuIndex);
      }

      logger.info('NvidiaGPU', 'Clock offset applied', {
        coreOffset,
        memoryOffset,
        targetGraphics,
        targetMemory,
      });
    } catch (error) {
      logger.error('NvidiaGPU', 'Failed to apply clock offset', error);
      throw error;
    }
  }

  /**
   * Reset clocks to default
   */
  async resetClocks(): Promise<void> {
    try {
      await this.nvml.resetGPUClocks(this.gpuIndex);
      await this.nvml.resetMemoryClocks(this.gpuIndex);
      await this.nvml.resetApplicationClocks(this.gpuIndex);

      logger.info('NvidiaGPU', 'Clocks reset to default');
    } catch (error) {
      logger.error('NvidiaGPU', 'Failed to reset clocks', error);
      throw error;
    }
  }

  /**
   * Get current clock speeds
   */
  async getCurrentClocks(): Promise<{ core: number; memory: number }> {
    const telemetry = await this.nvml.getTelemetry(this.gpuIndex);
    return {
      core: telemetry.clocks.graphics,
      memory: telemetry.clocks.memory,
    };
  }

  /**
   * Set power limit (in watts)
   */
  async setPowerLimit(watts: number): Promise<void> {
    try {
      const capabilities = await this.getCapabilities();
      if (!capabilities.supportsPowerLimit) {
        logger.warn('NvidiaGPU', 'Power limit control not supported; ignoring setPowerLimit()', {
          watts,
        });
        return;
      }

      // Clamp to valid range
      const clampedWatts = Math.max(
        capabilities.powerLimitRange.min,
        Math.min(capabilities.powerLimitRange.max, watts)
      );

      await this.nvml.setPowerLimit(this.gpuIndex, clampedWatts);

      logger.info('NvidiaGPU', `Power limit set to ${clampedWatts}W`);
    } catch (error) {
      logger.error('NvidiaGPU', 'Failed to set power limit', error);
      throw error;
    }
  }

  /**
   * Get current power limit
   */
  async getPowerLimit(): Promise<number> {
    const telemetry = await this.nvml.getTelemetry(this.gpuIndex);
    return telemetry.power.limit;
  }

  /**
   * Reset power limit to default
   */
  async resetPowerLimit(): Promise<void> {
    try {
      const capabilities = await this.getCapabilities();
      if (!capabilities.supportsPowerLimit) {
        logger.warn('NvidiaGPU', 'Power limit control not supported; ignoring resetPowerLimit()');
        return;
      }

      await this.nvml.resetPowerLimit(this.gpuIndex);
      logger.info('NvidiaGPU', 'Power limit reset to default');
    } catch (error) {
      logger.error('NvidiaGPU', 'Failed to reset power limit', error);
      throw error;
    }
  }

  /**
   * Set fan speed (not directly supported by nvidia-smi)
   */
  async setFanSpeed(_percentage: number): Promise<void> {
    logger.warn('NvidiaGPU', 'Fan speed control not supported via nvidia-smi');
    // Would require NVAPI for direct fan control
    throw new Error('Fan speed control requires NVAPI integration');
  }

  /**
   * Set fan curve
   */
  async setFanCurve(_curve: FanCurvePoint[]): Promise<void> {
    logger.warn('NvidiaGPU', 'Fan curve control not supported via nvidia-smi');
    // Would require NVAPI
    throw new Error('Fan curve control requires NVAPI integration');
  }

  /**
   * Reset fan control to auto
   */
  async resetFanControl(): Promise<void> {
    logger.info('NvidiaGPU', 'Fan control already in auto mode');
    // nvidia-smi doesn't override fan control, so this is a no-op
  }

  /**
   * Check if overclocking is supported
   */
  async checkOverclockSupport(): Promise<boolean> {
    return await this.nvml.supportsOverclocking(this.gpuIndex);
  }

  /**
   * Check if we have necessary privileges
   */
  async checkPrivileges(): Promise<boolean> {
    try {
      // Windows: confirm the process is elevated (admin).
      if (process.platform === 'win32') {
        await execAsync('net session', { windowsHide: true });
      }

      return true;
    } catch (error) {
      // Fallback: validate privileges by attempting a no-op privileged operation.
      try {
        const telemetry = await this.nvml.getTelemetry(this.gpuIndex);

        // Power limit write (no-op).
        try {
          await this.nvml.setPowerLimit(this.gpuIndex, telemetry.power.limit);
          return true;
        } catch {
          // ignore
        }

        // Clock lock/unlock (no-op).
        try {
          await this.nvml.lockGPUClocks(
            this.gpuIndex,
            telemetry.clocks.graphics,
            telemetry.clocks.graphics
          );
          await this.nvml.resetGPUClocks(this.gpuIndex);
          return true;
        } catch {
          // ignore
        }

        return false;
      } catch {
        logger.error('NvidiaGPU', 'Privilege check failed', error);
        return false;
      }
    }
  }

  /**
   * Check if GPU is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const telemetry = await this.getTelemetry();
      const limits = await this.getLimits();

      // Check temperature
      if (telemetry.temperature > limits.maxTemperature) {
        logger.warn('NvidiaGPU', 'GPU temperature exceeds limits', {
          current: telemetry.temperature,
          limit: limits.maxTemperature,
        });
        return false;
      }

      // Check for driver reset
      const driverReset = await this.nvml.checkDriverReset(this.gpuIndex);
      if (driverReset) {
        logger.error('NvidiaGPU', 'Driver reset detected');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('NvidiaGPU', 'Health check failed', error);
      return false;
    }
  }

  /**
   * Get driver version
   */
  async getDriverVersion(): Promise<string> {
    return await this.nvml.getDriverVersion();
  }

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    try {
      await this.resetClocks();
      await this.resetPowerLimit();
      await this.resetFanControl();

      logger.info('NvidiaGPU', 'All settings reset to defaults');
    } catch (error) {
      logger.error('NvidiaGPU', 'Failed to reset to defaults', error);
      throw error;
    }
  }

  /**
   * Parse throttle reasons from NVML data
   */
  private parseThrottleReasons(throttle: {
    thermal: boolean;
    power: boolean;
    sw: boolean;
    hwSlowdown: boolean;
  }): ThrottleReason[] {
    const reasons: ThrottleReason[] = [];

    if (throttle.thermal) {
      reasons.push(ThrottleReason.THERMAL);
    }
    if (throttle.power) {
      reasons.push(ThrottleReason.POWER);
    }
    if (throttle.sw) {
      reasons.push(ThrottleReason.SOFTWARE);
    }

    return reasons.length > 0 ? reasons : [ThrottleReason.NONE];
  }

  /**
   * Detect GPU architecture from name
   */
  private detectArchitecture(gpuName: string): string {
    const archMap: { [key: string]: string } = {
      'RTX 40': 'Ada Lovelace',
      'RTX 30': 'Ampere',
      'RTX 20': 'Turing',
      'GTX 16': 'Turing',
      'GTX 10': 'Pascal',
      'GTX 9': 'Maxwell',
    };

    for (const [key, arch] of Object.entries(archMap)) {
      if (gpuName.includes(key)) {
        return arch;
      }
    }

    return 'Unknown';
  }

  /**
   * Detect VRAM type from GPU name
   */
  private detectVRAMType(gpuName: string): string {
    if (gpuName.includes('RTX 40')) {
      return 'GDDR6X';
    }
    if (gpuName.includes('RTX 30') || gpuName.includes('RTX 20')) {
      return 'GDDR6';
    }
    if (gpuName.includes('GTX 10')) {
      return 'GDDR5X';
    }
    return 'GDDR6';
  }

  /**
   * Shutdown the interface
   */
  async shutdown(): Promise<void> {
    await this.nvml.shutdown();
    logger.info('NvidiaGPU', 'Interface shutdown');
  }
}
