/**
 * Mock GPU Interface for Testing
 */

import {
  IGPUInterface,
  GPUCapabilities,
  GPULimits,
} from '../../src/backend/hardware/gpu-interface';
import {
  GPUInfo,
  GPUTelemetry,
  ClockOffset,
  FanCurvePoint,
  ThrottleReason,
} from '../../src/backend/types';

export class MockGPUInterface extends IGPUInterface {
  private mockTelemetry: GPUTelemetry;
  private appliedClockOffset: ClockOffset = { core: 0, memory: 0 };
  private appliedPowerLimit: number = 100;
  private shouldFail: boolean = false;

  constructor() {
    super(0);

    this.mockTelemetry = {
      timestamp: Date.now(),
      coreClock: 1500,
      memoryClock: 7000,
      powerDraw: 200,
      temperature: 65,
      fanSpeed: 50,
      utilization: {
        gpu: 80,
        memory: 70,
      },
      throttleReasons: [ThrottleReason.NONE],
    };
  }

  async detectGPU(): Promise<GPUInfo> {
    return {
      id: 'mock-gpu-0',
      name: 'Mock NVIDIA RTX 3080',
      vendor: 'NVIDIA',
      architecture: 'Ampere',
      driverVersion: '527.00',
      vramSize: 10240,
      vramType: 'GDDR6X',
      busInterface: '0000:01:00.0',
      powerLimit: {
        default: 320,
        min: 240,
        max: 380,
        current: 320,
      },
      thermalLimit: 90,
      boost: true,
    };
  }

  async getTelemetry(): Promise<GPUTelemetry> {
    // Simulate telemetry changes based on applied settings
    return {
      ...this.mockTelemetry,
      timestamp: Date.now(),
      coreClock: 1500 + this.appliedClockOffset.core,
      memoryClock: 7000 + this.appliedClockOffset.memory,
      powerDraw: (200 * this.appliedPowerLimit) / 100,
    };
  }

  async getCapabilities(): Promise<GPUCapabilities> {
    return {
      supportsClockOffset: true,
      supportsPowerLimit: true,
      supportsFanControl: true,
      supportsVoltageControl: false,
      clockOffsetRange: {
        coreMin: -300,
        coreMax: 300,
        memoryMin: -1500,
        memoryMax: 1500,
      },
      powerLimitRange: {
        min: 240,
        max: 380,
        default: 320,
      },
      fanSpeedRange: {
        min: 0,
        max: 100,
      },
    };
  }

  async getLimits(): Promise<GPULimits> {
    return {
      maxTemperature: 95,
      maxPowerDraw: 380,
      thermalThrottleTemp: 83,
      powerThrottleLimit: 360,
    };
  }

  async applyClockOffset(offset: ClockOffset): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Mock GPU failure');
    }
    this.appliedClockOffset = offset;
  }

  async resetClocks(): Promise<void> {
    this.appliedClockOffset = { core: 0, memory: 0 };
  }

  async getCurrentClocks(): Promise<{ core: number; memory: number }> {
    return {
      core: 1500 + this.appliedClockOffset.core,
      memory: 7000 + this.appliedClockOffset.memory,
    };
  }

  async setPowerLimit(watts: number): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Mock GPU failure');
    }
    this.appliedPowerLimit = (watts / 320) * 100;
  }

  async getPowerLimit(): Promise<number> {
    return (320 * this.appliedPowerLimit) / 100;
  }

  async resetPowerLimit(): Promise<void> {
    this.appliedPowerLimit = 100;
  }

  async setFanSpeed(percentage: number): Promise<void> {
    // Mock implementation
  }

  async setFanCurve(curve: FanCurvePoint[]): Promise<void> {
    // Mock implementation
  }

  async resetFanControl(): Promise<void> {
    // Mock implementation
  }

  async checkOverclockSupport(): Promise<boolean> {
    return true;
  }

  async checkPrivileges(): Promise<boolean> {
    return true;
  }

  async isHealthy(): Promise<boolean> {
    return !this.shouldFail;
  }

  async getDriverVersion(): Promise<string> {
    return '527.00';
  }

  async resetToDefaults(): Promise<void> {
    await this.resetClocks();
    await this.resetPowerLimit();
  }

  // Test helpers
  setTemperature(temp: number): void {
    this.mockTelemetry.temperature = temp;
  }

  setThrottling(throttle: boolean): void {
    this.mockTelemetry.throttleReasons = throttle
      ? [ThrottleReason.THERMAL]
      : [ThrottleReason.NONE];
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  getAppliedSettings(): { clockOffset: ClockOffset; powerLimit: number } {
    return {
      clockOffset: this.appliedClockOffset,
      powerLimit: this.appliedPowerLimit,
    };
  }
}
