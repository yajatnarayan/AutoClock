/**
 * NVML (NVIDIA Management Library) Wrapper for Windows
 * Real hardware integration using nvidia-smi and WMI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface NVMLDevice {
  index: number;
  name: string;
  uuid: string;
  pciInfo: {
    busId: string;
    bus: number;
    device: number;
  };
}

export interface NVMLTelemetry {
  temperature: {
    gpu: number;
    hotspot?: number;
    memory?: number;
  };
  clocks: {
    graphics: number;
    sm: number;
    memory: number;
    video: number;
  };
  power: {
    draw: number;
    limit: number;
    default: number;
    min: number;
    max: number;
  };
  utilization: {
    gpu: number;
    memory: number;
    encoder?: number;
    decoder?: number;
  };
  memory: {
    used: number;
    free: number;
    total: number;
  };
  fan: {
    speed: number;
  };
  performance: {
    state: number; // P0-P12
  };
  throttle: {
    reasons: number;
    thermal: boolean;
    power: boolean;
    sw: boolean;
    hwSlowdown: boolean;
  };
  voltage?: {
    current: number;
  };
}

/**
 * NVML Wrapper using nvidia-smi CLI
 * Production version should use native NVML bindings (nvml.dll via FFI)
 */
export class NVMLWrapper {
  private nvidiaSmiPath: string;
  private initialized: boolean = false;

  constructor() {
    // Common nvidia-smi locations
    this.nvidiaSmiPath = this.findNvidiaSmi();
  }

  getNvidiaSmiPath(): string {
    return this.nvidiaSmiPath;
  }

  /**
   * Find nvidia-smi executable
   */
  private findNvidiaSmi(): string {
    const candidates: string[] = [];

    if (process.platform === 'win32') {
      const programFiles =
        process.env.ProgramFiles || 'C:\\Program Files';
      const programFilesX86 =
        process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const systemRoot = process.env.SystemRoot || 'C:\\Windows';

      candidates.push(
        path.join(programFiles, 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe')
      );
      candidates.push(
        path.join(programFilesX86, 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe')
      );
      candidates.push(path.join(systemRoot, 'System32', 'nvidia-smi.exe'));

      // Probe PATH for nvidia-smi.exe
      const pathEntries = (process.env.PATH || '').split(path.delimiter);
      for (const entry of pathEntries) {
        const candidate = path.join(entry, 'nvidia-smi.exe');
        candidates.push(candidate);
      }
    } else {
      // Probe PATH for nvidia-smi
      const pathEntries = (process.env.PATH || '').split(path.delimiter);
      for (const entry of pathEntries) {
        const candidate = path.join(entry, 'nvidia-smi');
        candidates.push(candidate);
      }
    }

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // Fall back to PATH resolution at runtime.
    return 'nvidia-smi';
  }

  /**
   * Initialize NVML
   */
  async initialize(): Promise<void> {
    try {
      // Test nvidia-smi availability
      await this.exec('--help');
      this.initialized = true;
      logger.info('NVML', 'NVML initialized successfully');
    } catch (error) {
      logger.error('NVML', 'Failed to initialize NVML', error);
      throw new Error('NVIDIA drivers not found or nvidia-smi not available');
    }
  }

  /**
   * Shutdown NVML
   */
  async shutdown(): Promise<void> {
    this.initialized = false;
    logger.info('NVML', 'NVML shutdown');
  }

  /**
   * Execute nvidia-smi command
   */
  private async exec(args: string, timeout: number = 5000): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(
        `"${this.nvidiaSmiPath}" ${args}`,
        { timeout }
      );

      if (stderr && stderr.length > 0) {
        logger.warn('NVML', 'nvidia-smi stderr', { stderr });
      }

      return stdout;
    } catch (error: any) {
      logger.error('NVML', 'nvidia-smi execution failed', {
        args,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get a reasonable baseline clock pair for "offset-like" tuning.
   * Prefers default application clocks, then current clocks as fallback.
   */
  async getBaselineClocks(index: number): Promise<{
    graphics: number;
    memory: number;
    source: 'default_applications' | 'applications' | 'current';
  }> {
    try {
      const query = [
        'clocks.default_applications.graphics',
        'clocks.default_applications.memory',
        'clocks.applications.graphics',
        'clocks.applications.memory',
        'clocks.current.graphics',
        'clocks.current.memory',
      ].join(',');

      const output = await this.exec(
        `--query-gpu=${query} --format=csv,noheader,nounits -i ${index}`
      );

      const parts = output.trim().split(',').map(s => s.trim());

      const defaultGraphics = parseFloat(parts[0]);
      const defaultMemory = parseFloat(parts[1]);
      if (Number.isFinite(defaultGraphics) && Number.isFinite(defaultMemory) && defaultGraphics > 0 && defaultMemory > 0) {
        return { graphics: defaultGraphics, memory: defaultMemory, source: 'default_applications' };
      }

      const appGraphics = parseFloat(parts[2]);
      const appMemory = parseFloat(parts[3]);
      if (Number.isFinite(appGraphics) && Number.isFinite(appMemory) && appGraphics > 0 && appMemory > 0) {
        return { graphics: appGraphics, memory: appMemory, source: 'applications' };
      }

      const currentGraphics = parseFloat(parts[4]);
      const currentMemory = parseFloat(parts[5]);
      if (Number.isFinite(currentGraphics) && Number.isFinite(currentMemory) && currentGraphics > 0 && currentMemory > 0) {
        return { graphics: currentGraphics, memory: currentMemory, source: 'current' };
      }

      throw new Error(`Unable to parse baseline clocks from: "${output.trim()}"`);
    } catch (error) {
      // Final fallback: use current telemetry.
      const telemetry = await this.getTelemetry(index);
      return {
        graphics: telemetry.clocks.graphics,
        memory: telemetry.clocks.memory,
        source: 'current',
      };
    }
  }

  /**
   * Get device count
   */
  async getDeviceCount(): Promise<number> {
    const output = await this.exec('--query-gpu=count --format=csv,noheader');
    return parseInt(output.trim());
  }

  /**
   * Get device handle by index
   */
  async getDeviceByIndex(index: number): Promise<NVMLDevice> {
    const query = 'name,uuid,pci.bus_id,pci.bus,pci.device';
    const output = await this.exec(
      `--query-gpu=${query} --format=csv,noheader,nounits -i ${index}`
    );

    const parts = output.trim().split(',').map(s => s.trim());

    return {
      index,
      name: parts[0],
      uuid: parts[1],
      pciInfo: {
        busId: parts[2],
        bus: parseInt(parts[3], 16),
        device: parseInt(parts[4], 16),
      },
    };
  }

  /**
   * Get comprehensive telemetry
   */
  async getTelemetry(index: number): Promise<NVMLTelemetry> {
    const queries = [
      // Temperature
      'temperature.gpu',
      // Clocks
      'clocks.current.graphics',
      'clocks.current.sm',
      'clocks.current.memory',
      'clocks.current.video',
      // Power
      'power.draw',
      'power.limit',
      'power.default_limit',
      'power.min_limit',
      'power.max_limit',
      // Utilization
      'utilization.gpu',
      'utilization.memory',
      // Memory
      'memory.used',
      'memory.free',
      'memory.total',
      // Fan
      'fan.speed',
      // Performance state
      'pstate',
      // Throttle reasons
      'clocks_throttle_reasons.active',
      'clocks_throttle_reasons.gpu_idle',
      'clocks_throttle_reasons.applications_clocks_setting',
      'clocks_throttle_reasons.sw_power_cap',
      'clocks_throttle_reasons.hw_slowdown',
      'clocks_throttle_reasons.hw_thermal_slowdown',
      'clocks_throttle_reasons.hw_power_brake_slowdown',
    ];

    const queryString = queries.join(',');
    const output = await this.exec(
      `--query-gpu=${queryString} --format=csv,noheader,nounits -i ${index}`
    );

    const values = output.trim().split(',').map(s => s.trim());
    let i = 0;

    // Parse throttle reasons
    i++; // clocks_throttle_reasons.active (string summary)
    i++; // clocks_throttle_reasons.gpu_idle
    const throttleAppSettings = values[i++] === 'Active';
    const throttlePower = values[i++] === 'Active';
    const throttleHwSlowdown = values[i++] === 'Active';
    const throttleThermal = values[i++] === 'Active';
    const throttlePowerBrake = values[i++] === 'Active';

    return {
      temperature: {
        gpu: parseFloat(values[i++]),
      },
      clocks: {
        graphics: parseFloat(values[i++]),
        sm: parseFloat(values[i++]),
        memory: parseFloat(values[i++]),
        video: parseFloat(values[i++]),
      },
      power: {
        draw: parseFloat(values[i++]),
        limit: parseFloat(values[i++]),
        default: parseFloat(values[i++]),
        min: parseFloat(values[i++]),
        max: parseFloat(values[i++]),
      },
      utilization: {
        gpu: parseFloat(values[i++]),
        memory: parseFloat(values[i++]),
      },
      memory: {
        used: parseFloat(values[i++]),
        free: parseFloat(values[i++]),
        total: parseFloat(values[i++]),
      },
      fan: {
        speed: parseFloat(values[i++]),
      },
      performance: {
        state: parseInt(values[i++].replace('P', '')),
      },
      throttle: {
        reasons: 0, // Would parse from hex
        thermal: throttleThermal || throttlePowerBrake,
        power: throttlePower,
        sw: throttleAppSettings,
        hwSlowdown: throttleHwSlowdown,
      },
    };
  }

  /**
   * Set power limit (in watts)
   */
  async setPowerLimit(index: number, watts: number): Promise<void> {
    await this.exec(`-i ${index} -pl ${watts}`);
    logger.info('NVML', `Power limit set to ${watts}W on GPU ${index}`);
  }

  /**
   * Reset power limit to default
   */
  async resetPowerLimit(index: number): Promise<void> {
    const output = await this.exec(
      `--query-gpu=power.default_limit --format=csv,noheader,nounits -i ${index}`
    );
    const defaultLimitWatts = parseFloat(output.trim());

    if (!Number.isFinite(defaultLimitWatts)) {
      throw new Error(`Failed to parse default power limit: "${output.trim()}"`);
    }

    await this.setPowerLimit(index, defaultLimitWatts);
    logger.info('NVML', `Power limit reset to default on GPU ${index}`, {
      defaultLimitWatts,
    });
  }

  /**
   * Set GPU clocks (application clocks)
   */
  async setApplicationClocks(
    index: number,
    memoryClock: number,
    graphicsClock: number
  ): Promise<void> {
    await this.exec(`-i ${index} -ac ${memoryClock},${graphicsClock}`);
    logger.info('NVML', `Application clocks set on GPU ${index}`, {
      memoryClock,
      graphicsClock,
    });
  }

  /**
   * Reset GPU clocks
   */
  async resetApplicationClocks(index: number): Promise<void> {
    await this.exec(`-i ${index} -rac`);
    logger.info('NVML', `Application clocks reset on GPU ${index}`);
  }

  /**
   * Lock GPU clocks to a specific frequency (for testing/benchmarking)
   */
  async lockGPUClocks(
    index: number,
    minClock: number,
    maxClock: number
  ): Promise<void> {
    await this.exec(`-i ${index} -lgc ${minClock},${maxClock}`);
    logger.info('NVML', `GPU clocks locked on GPU ${index}`, { minClock, maxClock });
  }

  /**
   * Reset GPU clock locks
   */
  async resetGPUClocks(index: number): Promise<void> {
    await this.exec(`-i ${index} -rgc`);
    logger.info('NVML', `GPU clock locks reset on GPU ${index}`);
  }

  /**
   * Lock memory clocks
   */
  async lockMemoryClocks(
    index: number,
    minClock: number,
    maxClock: number
  ): Promise<void> {
    await this.exec(`-i ${index} -lmc ${minClock},${maxClock}`);
    logger.info('NVML', `Memory clocks locked on GPU ${index}`, { minClock, maxClock });
  }

  /**
   * Reset memory clock locks
   */
  async resetMemoryClocks(index: number): Promise<void> {
    await this.exec(`-i ${index} -rmc`);
    logger.info('NVML', `Memory clock locks reset on GPU ${index}`);
  }

  /**
   * Get driver version
   */
  async getDriverVersion(): Promise<string> {
    const output = await this.exec('--query-gpu=driver_version --format=csv,noheader');
    return output.trim();
  }

  /**
   * Get supported clocks for a GPU
   */
  async getSupportedClocks(_index: number): Promise<{
    memory: number[];
    graphics: { [memClock: number]: number[] };
  }> {
    // This requires parsing nvidia-smi -q output
    // For MVP, return empty - this would be populated in production
    return {
      memory: [],
      graphics: {},
    };
  }

  /**
   * Check if GPU supports overclocking
   */
  async supportsOverclocking(index: number): Promise<boolean> {
    try {
      // Perform a no-op lock/unlock cycle on both GPU and memory clocks.
      // This validates that the driver/hardware supports the control path and that we have privileges.
      const telemetry = await this.getTelemetry(index);

      await this.lockGPUClocks(index, telemetry.clocks.graphics, telemetry.clocks.graphics);
      await this.resetGPUClocks(index);

      await this.lockMemoryClocks(index, telemetry.clocks.memory, telemetry.clocks.memory);
      await this.resetMemoryClocks(index);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current performance state
   */
  async getPerformanceState(index: number): Promise<number> {
    const output = await this.exec(
      `--query-gpu=pstate --format=csv,noheader -i ${index}`
    );
    return parseInt(output.trim().replace('P', ''));
  }

  /**
   * Check if a driver reset occurred
   */
  async checkDriverReset(index: number): Promise<boolean> {
    try {
      // If we can query the GPU, driver is OK
      await this.exec(`--query-gpu=name --format=csv,noheader -i ${index}`);
      return false;
    } catch {
      // If query fails, driver may have reset
      logger.error('NVML', `Possible driver reset detected on GPU ${index}`);
      return true;
    }
  }
}
