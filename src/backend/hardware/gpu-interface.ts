/**
 * GPU Hardware Interface - Abstract base for vendor implementations
 * Designed for multi-GPU and multi-vendor support (NVIDIA, AMD future)
 */

import { GPUInfo, GPUTelemetry, ClockOffset, FanCurvePoint } from '../types';

export interface GPUCapabilities {
  supportsClockOffset: boolean;
  supportsPowerLimit: boolean;
  supportsFanControl: boolean;
  supportsVoltageControl: boolean;
  clockOffsetRange: {
    coreMin: number;
    coreMax: number;
    memoryMin: number;
    memoryMax: number;
  };
  powerLimitRange: {
    min: number;
    max: number;
    default: number;
  };
  fanSpeedRange: {
    min: number;
    max: number;
  };
}

export interface GPULimits {
  maxTemperature: number;
  maxPowerDraw: number;
  thermalThrottleTemp: number;
  powerThrottleLimit: number;
}

/**
 * Abstract GPU interface - implement for each vendor
 */
export abstract class IGPUInterface {
  protected gpuIndex: number;

  constructor(gpuIndex: number = 0) {
    this.gpuIndex = gpuIndex;
  }

  // Core operations
  abstract detectGPU(): Promise<GPUInfo>;
  abstract getTelemetry(): Promise<GPUTelemetry>;
  abstract getCapabilities(): Promise<GPUCapabilities>;
  abstract getLimits(): Promise<GPULimits>;

  // Clock control
  abstract applyClockOffset(offset: ClockOffset): Promise<void>;
  abstract resetClocks(): Promise<void>;
  abstract getCurrentClocks(): Promise<{ core: number; memory: number }>;

  // Power control
  abstract setPowerLimit(watts: number): Promise<void>;
  abstract getPowerLimit(): Promise<number>;
  abstract resetPowerLimit(): Promise<void>;

  // Fan control
  abstract setFanSpeed(percentage: number): Promise<void>;
  abstract setFanCurve(curve: FanCurvePoint[]): Promise<void>;
  abstract resetFanControl(): Promise<void>;

  // Validation
  abstract checkOverclockSupport(): Promise<boolean>;
  abstract checkPrivileges(): Promise<boolean>;
  abstract isHealthy(): Promise<boolean>;

  // Utilities
  abstract getDriverVersion(): Promise<string>;
  abstract resetToDefaults(): Promise<void>;
}

/**
 * Multi-GPU manager
 */
export class GPUManager {
  private gpus: Map<number, IGPUInterface> = new Map();

  async detectGPUs(): Promise<IGPUInterface[]> {
    // TODO: Implement multi-GPU detection
    // For now, returns array of detected GPUs
    return [];
  }

  getGPU(index: number): IGPUInterface | undefined {
    return this.gpus.get(index);
  }

  getAllGPUs(): IGPUInterface[] {
    return Array.from(this.gpus.values());
  }

  async addGPU(gpu: IGPUInterface, index: number): Promise<void> {
    this.gpus.set(index, gpu);
  }
}
