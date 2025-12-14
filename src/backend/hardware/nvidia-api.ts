/**
 * NVIDIA GPU API wrapper using nvidia-smi and WMI
 * Provides hardware detection and telemetry collection
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { GPUInfo, GPUTelemetry, ThrottleReason, ClockOffset } from '../types';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export class NvidiaAPI {
  private gpuIndex: number;

  constructor(gpuIndex: number = 0) {
    this.gpuIndex = gpuIndex;
  }

  /**
   * Detect NVIDIA GPU hardware information
   */
  async detectGPU(): Promise<GPUInfo> {
    try {
      const query = [
        'gpu_name',
        'driver_version',
        'memory.total',
        'pci.bus_id',
        'power.default_limit',
        'power.min_limit',
        'power.max_limit',
        'power.limit',
        'temperature.gpu.tlimit'
      ].join(',');

      const { stdout } = await execAsync(
        `nvidia-smi --query-gpu=${query} --format=csv,noheader,nounits -i ${this.gpuIndex}`
      );

      const values = stdout.trim().split(',').map(v => v.trim());

      const gpuInfo: GPUInfo = {
        id: `nvidia-${this.gpuIndex}`,
        name: values[0],
        vendor: 'NVIDIA',
        architecture: this.detectArchitecture(values[0]),
        driverVersion: values[1],
        vramSize: parseInt(values[2]),
        vramType: await this.detectVRAMType(),
        busInterface: values[3],
        powerLimit: {
          default: parseFloat(values[4]),
          min: parseFloat(values[5]),
          max: parseFloat(values[6]),
          current: parseFloat(values[7]),
        },
        thermalLimit: parseInt(values[8]),
        boost: true,
      };

      logger.info('NvidiaAPI', 'GPU detected successfully', gpuInfo);
      return gpuInfo;
    } catch (error) {
      logger.error('NvidiaAPI', 'Failed to detect GPU', error);
      throw new Error(`Failed to detect NVIDIA GPU: ${error}`);
    }
  }

  /**
   * Collect real-time telemetry data
   */
  async getTelemetry(): Promise<GPUTelemetry> {
    try {
      const query = [
        'timestamp',
        'clocks.current.graphics',
        'clocks.current.memory',
        'power.draw',
        'temperature.gpu',
        'fan.speed',
        'utilization.gpu',
        'utilization.memory',
        'clocks.throttle_reasons.active'
      ].join(',');

      const { stdout } = await execAsync(
        `nvidia-smi --query-gpu=${query} --format=csv,noheader,nounits -i ${this.gpuIndex}`
      );

      const values = stdout.trim().split(',').map(v => v.trim());

      const telemetry: GPUTelemetry = {
        timestamp: Date.now(),
        coreClock: parseInt(values[1]),
        memoryClock: parseInt(values[2]),
        powerDraw: parseFloat(values[3]),
        temperature: parseInt(values[4]),
        fanSpeed: parseInt(values[5]),
        utilization: {
          gpu: parseInt(values[6]),
          memory: parseInt(values[7]),
        },
        throttleReasons: this.parseThrottleReasons(values[8]),
      };

      return telemetry;
    } catch (error) {
      logger.error('NvidiaAPI', 'Failed to get telemetry', error);
      throw new Error(`Failed to get GPU telemetry: ${error}`);
    }
  }

  /**
   * Apply clock offsets using nvidia-settings or nvidia-smi
   */
  async applyClockOffset(offset: ClockOffset): Promise<void> {
    try {
      // Apply core clock offset
      await execAsync(
        `nvidia-smi -i ${this.gpuIndex} --lock-gpu-clocks=${offset.core},${offset.core}`
      );

      // Apply memory clock offset
      await execAsync(
        `nvidia-smi -i ${this.gpuIndex} --lock-memory-clocks=${offset.memory},${offset.memory}`
      );

      logger.info('NvidiaAPI', 'Clock offset applied', offset);
    } catch (error) {
      logger.error('NvidiaAPI', 'Failed to apply clock offset', error);
      throw new Error(`Failed to apply clock offset: ${error}`);
    }
  }

  /**
   * Reset clocks to default
   */
  async resetClocks(): Promise<void> {
    try {
      await execAsync(`nvidia-smi -i ${this.gpuIndex} --reset-gpu-clocks`);
      await execAsync(`nvidia-smi -i ${this.gpuIndex} --reset-memory-clocks`);
      logger.info('NvidiaAPI', 'Clocks reset to default');
    } catch (error) {
      logger.error('NvidiaAPI', 'Failed to reset clocks', error);
      throw new Error(`Failed to reset clocks: ${error}`);
    }
  }

  /**
   * Set power limit (percentage of max)
   */
  async setPowerLimit(percentage: number): Promise<void> {
    try {
      const gpuInfo = await this.detectGPU();
      const powerLimit = (gpuInfo.powerLimit.max * percentage) / 100;

      await execAsync(
        `nvidia-smi -i ${this.gpuIndex} --power-limit=${powerLimit}`
      );

      logger.info('NvidiaAPI', `Power limit set to ${percentage}%`, { powerLimit });
    } catch (error) {
      logger.error('NvidiaAPI', 'Failed to set power limit', error);
      throw new Error(`Failed to set power limit: ${error}`);
    }
  }

  /**
   * Check if driver supports overclocking
   */
  async checkOverclockSupport(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('nvidia-smi --help');
      return stdout.includes('--lock-gpu-clocks') && stdout.includes('--lock-memory-clocks');
    } catch (error) {
      logger.error('NvidiaAPI', 'Failed to check overclock support', error);
      return false;
    }
  }

  private detectArchitecture(gpuName: string): string {
    const archMap: { [key: string]: string } = {
      'RTX 40': 'Ada Lovelace',
      'RTX 30': 'Ampere',
      'RTX 20': 'Turing',
      'GTX 16': 'Turing',
      'GTX 10': 'Pascal',
    };

    for (const [key, arch] of Object.entries(archMap)) {
      if (gpuName.includes(key)) {
        return arch;
      }
    }

    return 'Unknown';
  }

  private async detectVRAMType(): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `nvidia-smi --query-gpu=memory.bus --format=csv,noheader -i ${this.gpuIndex}`
      );
      const busWidth = parseInt(stdout.trim());

      // Heuristic based on bus width and generation
      if (busWidth >= 256) return 'GDDR6X';
      if (busWidth >= 192) return 'GDDR6';
      return 'GDDR5';
    } catch (error) {
      return 'Unknown';
    }
  }

  private parseThrottleReasons(reasonString: string): ThrottleReason[] {
    const reasons: ThrottleReason[] = [];

    if (reasonString.includes('None')) {
      return [ThrottleReason.NONE];
    }

    if (reasonString.includes('Thermal')) {
      reasons.push(ThrottleReason.THERMAL);
    }
    if (reasonString.includes('Power')) {
      reasons.push(ThrottleReason.POWER);
    }
    if (reasonString.includes('SW')) {
      reasons.push(ThrottleReason.SOFTWARE);
    }

    return reasons.length > 0 ? reasons : [ThrottleReason.NONE];
  }
}
