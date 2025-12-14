/**
 * Enhanced GPU Stress Test Engine
 * Continuous stress testing during tuning with real-time stability monitoring
 */

import { EventEmitter } from 'events';
import { WorkloadRunner, WorkloadConfig } from './workload-runner';
import { TelemetryService } from '../hardware/telemetry-service';
import { IGPUInterface } from '../hardware/gpu-interface';
import { WindowsEventMonitor } from '../hardware/windows-event-monitor';
import { logger } from '../utils/production-logger';

export interface StressTestConfig {
  duration: number; // seconds
  intensity: 'light' | 'medium' | 'heavy' | 'extreme';
  continuousMonitoring: boolean;
  targetUtilization?: number; // percentage
  allowThermalThrottle?: boolean;
  maxTemperature: number;
  maxPowerDraw?: number;
}

export interface StressTestResult {
  passed: boolean;
  duration: number;
  avgTemperature: number;
  maxTemperature: number;
  avgPowerDraw: number;
  maxPowerDraw: number;
  avgGpuUtilization: number;
  avgCoreClock: number;
  avgMemoryClock: number;
  throttleEvents: number;
  clockDropEvents: number;
  driverResets: number;
  crashed: boolean;
  artifactsDetected: boolean;
  stabilityScore: number; // 0-100
  issues: string[];
}

/**
 * Enhanced GPU Stress Test Engine
 * Runs GPU under continuous heavy load while monitoring stability
 */
export class StressTestEngine extends EventEmitter {
  private workloadRunner: WorkloadRunner;
  private telemetry: TelemetryService;
  private gpuInterface: IGPUInterface;
  private eventMonitor: WindowsEventMonitor;
  private isRunning: boolean = false;
  private stopRequested: boolean = false;

  constructor(
    telemetry: TelemetryService,
    gpuInterface: IGPUInterface
  ) {
    super();
    this.telemetry = telemetry;
    this.gpuInterface = gpuInterface;
    this.workloadRunner = new WorkloadRunner();
    this.eventMonitor = new WindowsEventMonitor();
  }

  /**
   * Run comprehensive stress test with continuous monitoring
   */
  async runStressTest(config: StressTestConfig): Promise<StressTestResult> {
    if (this.isRunning) {
      throw new Error('Stress test already running');
    }

    this.isRunning = true;
    this.stopRequested = false;

    logger.info('StressTestEngine', 'Starting stress test', config);

    const result: StressTestResult = {
      passed: true,
      duration: 0,
      avgTemperature: 0,
      maxTemperature: 0,
      avgPowerDraw: 0,
      maxPowerDraw: 0,
      avgGpuUtilization: 0,
      avgCoreClock: 0,
      avgMemoryClock: 0,
      throttleEvents: 0,
      clockDropEvents: 0,
      driverResets: 0,
      crashed: false,
      artifactsDetected: false,
      stabilityScore: 100,
      issues: [],
    };

    // Start Windows Event Log monitoring
    this.eventMonitor.start(1000);

    const startTime = Date.now();
    const telemetryHistory: any[] = [];

    try {
      // Configure workload based on intensity
      const workloadConfig: WorkloadConfig = {
        duration: config.duration,
        preset: this.mapIntensityToPreset(config.intensity),
      };

      // Start workload in background
      const workloadPromise = this.workloadRunner.runWorkload(workloadConfig);

      // Monitor telemetry continuously during workload
      const monitoringPromise = this.monitorDuringStress(
        config,
        telemetryHistory,
        result
      );

      // Wait for both workload and monitoring to complete
      const [workloadResult] = await Promise.all([
        workloadPromise,
        monitoringPromise,
      ]);

      // Check if workload crashed
      if (workloadResult.crashed || !workloadResult.completed) {
        result.crashed = true;
        result.passed = false;
        result.issues.push('Workload crashed or did not complete');
        logger.error('StressTestEngine', 'Workload failed', workloadResult);
      }

      // Calculate statistics from telemetry
      this.calculateStatistics(telemetryHistory, result);

      // Check for driver resets
      const driverReset = await this.eventMonitor.checkDriverReset(
        Math.ceil(config.duration / 60)
      );
      if (driverReset) {
        result.driverResets++;
        result.passed = false;
        result.issues.push('Driver reset detected during stress test');
      }

      // Calculate stability score
      result.stabilityScore = this.calculateStabilityScore(result);

      // Final validation
      if (result.maxTemperature > config.maxTemperature) {
        result.passed = false;
        result.issues.push(
          `Maximum temperature ${result.maxTemperature}°C exceeded limit ${config.maxTemperature}°C`
        );
      }

      if (config.maxPowerDraw && result.maxPowerDraw > config.maxPowerDraw) {
        result.passed = false;
        result.issues.push(
          `Maximum power draw ${result.maxPowerDraw}W exceeded limit ${config.maxPowerDraw}W`
        );
      }

      if (result.throttleEvents > 0 && !config.allowThermalThrottle) {
        result.passed = false;
        result.issues.push(`${result.throttleEvents} throttling events detected`);
      }

      result.duration = (Date.now() - startTime) / 1000;

      logger.info('StressTestEngine', 'Stress test completed', {
        passed: result.passed,
        stabilityScore: result.stabilityScore,
        duration: result.duration,
      });

      return result;
    } catch (error: any) {
      logger.error('StressTestEngine', 'Stress test failed with exception', error);
      result.crashed = true;
      result.passed = false;
      result.issues.push(`Exception: ${error.message}`);
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    } finally {
      this.isRunning = false;
      this.eventMonitor.stop();
      this.workloadRunner.stop();
    }
  }

  /**
   * Monitor GPU telemetry during stress test
   */
  private async monitorDuringStress(
    config: StressTestConfig,
    telemetryHistory: any[],
    result: StressTestResult
  ): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + config.duration * 1000;
    let lastClockValue = 0;

    while (Date.now() < endTime && !this.stopRequested) {
      try {
        // Collect current telemetry
        const telemetry = await this.gpuInterface.getTelemetry();
        telemetryHistory.push({
          ...telemetry,
          timestamp: Date.now(),
        });

        // Real-time checks
        // 1. Temperature check
        if (telemetry.temperature > config.maxTemperature) {
          logger.error('StressTestEngine', 'Temperature limit exceeded', {
            temp: telemetry.temperature,
            limit: config.maxTemperature,
          });

          this.emit('critical-temperature', telemetry.temperature);
          result.passed = false;
          result.issues.push(
            `Critical temperature: ${telemetry.temperature}°C at ${
              (Date.now() - startTime) / 1000
            }s`
          );

          // Emergency stop on critical temperature (>95°C)
          if (telemetry.temperature > 95) {
            this.stopRequested = true;
            break;
          }
        }

        // 2. Throttling detection
        if (telemetry.throttleReasons && telemetry.throttleReasons.length > 0) {
          const hasThrottle = telemetry.throttleReasons.some(
            (r) => r !== 'none'
          );
          if (hasThrottle) {
            result.throttleEvents++;
            logger.warn('StressTestEngine', 'Throttling detected', {
              reasons: telemetry.throttleReasons,
            });
          }
        }

        // 3. Clock drop detection (indicates instability)
        if (lastClockValue > 0) {
          const clockDrop = lastClockValue - telemetry.coreClock;
          if (clockDrop > 200) {
            // More than 200 MHz drop
            result.clockDropEvents++;
            logger.warn('StressTestEngine', 'Significant clock drop detected', {
              drop: clockDrop,
              from: lastClockValue,
              to: telemetry.coreClock,
            });
          }
        }
        lastClockValue = telemetry.coreClock;

        // 4. Power limit check
        if (config.maxPowerDraw && telemetry.powerDraw > config.maxPowerDraw) {
          logger.warn('StressTestEngine', 'Power draw exceeds limit', {
            power: telemetry.powerDraw,
            limit: config.maxPowerDraw,
          });
        }

        // 5. GPU utilization check
        if (config.targetUtilization) {
          if (telemetry.utilization.gpu < config.targetUtilization * 0.8) {
            logger.warn('StressTestEngine', 'Low GPU utilization during stress', {
              utilization: telemetry.utilization.gpu,
              target: config.targetUtilization,
            });
          }
        }

        // Emit progress event
        const elapsed = (Date.now() - startTime) / 1000;
        this.emit('progress', {
          elapsed,
          total: config.duration,
          percentage: (elapsed / config.duration) * 100,
          temperature: telemetry.temperature,
          coreClock: telemetry.coreClock,
          powerDraw: telemetry.powerDraw,
          utilization: telemetry.utilization.gpu,
        });

        // Wait 1 second before next sample
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error('StressTestEngine', 'Monitoring error', error);
        result.issues.push(`Monitoring error: ${error}`);
      }
    }
  }

  /**
   * Calculate statistics from telemetry history
   */
  private calculateStatistics(
    telemetryHistory: any[],
    result: StressTestResult
  ): void {
    if (telemetryHistory.length === 0) {
      logger.warn('StressTestEngine', 'No telemetry data collected');
      return;
    }

    const temps = telemetryHistory.map((t) => t.temperature);
    const powers = telemetryHistory.map((t) => t.powerDraw);
    const utils = telemetryHistory.map((t) => t.utilization);
    const coreClocks = telemetryHistory.map((t) => t.coreClock);
    const memClocks = telemetryHistory.map((t) => t.memoryClock);

    result.avgTemperature = this.average(temps);
    result.maxTemperature = Math.max(...temps);
    result.avgPowerDraw = this.average(powers);
    result.maxPowerDraw = Math.max(...powers);
    result.avgGpuUtilization = this.average(utils);
    result.avgCoreClock = this.average(coreClocks);
    result.avgMemoryClock = this.average(memClocks);

    logger.info('StressTestEngine', 'Statistics calculated', {
      avgTemp: result.avgTemperature.toFixed(1),
      maxTemp: result.maxTemperature.toFixed(1),
      avgPower: result.avgPowerDraw.toFixed(1),
      avgUtil: result.avgGpuUtilization.toFixed(1),
    });
  }

  /**
   * Calculate stability score (0-100)
   */
  private calculateStabilityScore(result: StressTestResult): number {
    let score = 100;

    // Deduct points for issues
    if (result.crashed) score -= 100;
    if (result.driverResets > 0) score -= 50 * result.driverResets;
    if (result.throttleEvents > 0) score -= Math.min(30, result.throttleEvents * 2);
    if (result.clockDropEvents > 0)
      score -= Math.min(20, result.clockDropEvents * 1);
    if (result.artifactsDetected) score -= 40;

    // Temperature penalty
    if (result.maxTemperature > 90) score -= 10;
    if (result.maxTemperature > 95) score -= 20;

    return Math.max(0, score);
  }

  /**
   * Map intensity to workload preset
   */
  private mapIntensityToPreset(
    intensity: string
  ): 'light' | 'medium' | 'heavy' {
    switch (intensity) {
      case 'light':
        return 'light';
      case 'medium':
        return 'medium';
      case 'heavy':
      case 'extreme':
        return 'heavy';
      default:
        return 'medium';
    }
  }

  /**
   * Calculate average of array
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Run quick stress test (10-15 seconds)
   */
  async runQuickStressTest(): Promise<boolean> {
    logger.info('StressTestEngine', 'Running quick stress test');

    const result = await this.runStressTest({
      duration: 10,
      intensity: 'medium',
      continuousMonitoring: true,
      maxTemperature: 90,
    });

    return result.passed && result.stabilityScore >= 80;
  }

  /**
   * Run extreme stress test for final validation
   */
  async runExtremeStressTest(duration: number = 60): Promise<StressTestResult> {
    logger.info('StressTestEngine', 'Running extreme stress test', { duration });

    return await this.runStressTest({
      duration,
      intensity: 'extreme',
      continuousMonitoring: true,
      maxTemperature: 90,
      targetUtilization: 95,
      allowThermalThrottle: false,
    });
  }

  /**
   * Stop running stress test
   */
  stop(): void {
    this.stopRequested = true;
    this.workloadRunner.stop();
    logger.info('StressTestEngine', 'Stop requested');
  }

  /**
   * Check if stress test is running
   */
  isStressTestRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get available stress test tools
   */
  async getAvailableTools(): Promise<{
    furMark: boolean;
    heaven: boolean;
    compute: boolean;
  }> {
    return await this.workloadRunner.checkAvailability();
  }
}
