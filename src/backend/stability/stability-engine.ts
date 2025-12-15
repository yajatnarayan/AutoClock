/**
 * Production Stability Validation Engine
 * Real driver reset detection, crash monitoring, and multi-layer validation
 */

import { TuningConfiguration, StabilityTestResult } from '../types';
import { TelemetryService } from '../hardware/telemetry-service';
import { WindowsEventMonitor } from '../hardware/windows-event-monitor';
import { WorkloadRunner } from '../benchmarking/workload-runner';
import { IGPUInterface } from '../hardware/gpu-interface';
import { logger } from '../utils/production-logger';

export class StabilityEngine {
  private telemetryCollector: TelemetryService;
  private eventMonitor: WindowsEventMonitor;
  private workloadRunner: WorkloadRunner;
  private gpuInterface: IGPUInterface;
  private knownGoodConfig?: TuningConfiguration;

  constructor(
    telemetryCollector: TelemetryService,
    gpuInterface: IGPUInterface
  ) {
    this.telemetryCollector = telemetryCollector;
    this.eventMonitor = new WindowsEventMonitor();
    this.workloadRunner = new WorkloadRunner();
    this.gpuInterface = gpuInterface;
  }

  /**
   * Set known-good configuration for rollback
   */
  setKnownGoodConfig(config: TuningConfiguration): void {
    this.knownGoodConfig = config;
    logger.info('StabilityEngine', 'Known-good configuration set', {
      id: config.id,
      name: config.name,
    });
  }

  /**
   * Validate a tuning configuration
   * Multi-layer testing with real hardware monitoring
   */
  async validate(config: TuningConfiguration): Promise<StabilityTestResult> {
    logger.info('StabilityEngine', `Validating configuration: ${config.name}`);

    const result: StabilityTestResult = {
      passed: true,
      driverReset: false,
      artifacting: false,
      crashes: 0,
      thermalThrottle: false,
      powerThrottle: false,
      performanceRegression: false,
      errorMessages: [],
      timestamp: Date.now(),
    };

    // Start event monitoring
    this.eventMonitor.start(2000);

    try {
      // Layer 1: GPU Health Check
      const healthOK = await this.checkGPUHealth(result);
      if (!healthOK) {
        result.passed = false;
        return result;
      }

      // Layer 2: Synthetic Stress Test
      const stressOK = await this.runStressTest(result);
      if (!stressOK) {
        result.passed = false;
        return result;
      }

      // Layer 3: Real Workload Test
      const workloadOK = await this.runWorkloadTest(result);
      if (!workloadOK) {
        result.passed = false;
        return result;
      }

      // Layer 4: Telemetry Analysis
      const telemetryOK = await this.analyzeTelemetry(result);
      if (!telemetryOK) {
        result.passed = false;
        return result;
      }

      // Layer 5: Driver Stability Check
      const driverOK = await this.checkDriverStability(result);
      if (!driverOK) {
        result.passed = false;
        return result;
      }

      logger.info('StabilityEngine', 'Validation passed', { config: config.id });
      return result;
    } catch (error: any) {
      logger.error('StabilityEngine', 'Validation failed with exception', error);
      result.passed = false;
      result.crashes++;
      result.errorMessages.push(`Validation exception: ${error.message}`);
      return result;
    } finally {
      this.eventMonitor.stop();
    }
  }

  /**
   * Layer 1: Check GPU health before testing
   */
  private async checkGPUHealth(result: StabilityTestResult): Promise<boolean> {
    logger.info('StabilityEngine', 'Layer 1: GPU Health Check');

    try {
      const healthy = await this.gpuInterface.isHealthy();

      if (!healthy) {
        result.errorMessages.push('GPU health check failed');
        logger.error('StabilityEngine', 'GPU not healthy');
        return false;
      }

      // Check current temperature
      const telemetry = await this.gpuInterface.getTelemetry();
      if (telemetry.temperature > 90) {
        result.thermalThrottle = true;
        result.errorMessages.push(`Temperature too high: ${telemetry.temperature}°C`);
        logger.error('StabilityEngine', 'Temperature too high', {
          temp: telemetry.temperature,
        });
        return false;
      }

      logger.info('StabilityEngine', 'GPU health check passed');
      return true;
    } catch (error) {
      result.errorMessages.push('GPU health check failed');
      logger.error('StabilityEngine', 'Health check error', error);
      return false;
    }
  }

  /**
   * Layer 2: Run synthetic stress test
   */
  private async runStressTest(result: StabilityTestResult): Promise<boolean> {
    logger.info('StabilityEngine', 'Layer 2: Synthetic Stress Test');

    this.telemetryCollector.clearHistory();

    try {
      // Run 30-second stress test
      const workloadResult = await this.workloadRunner.runWorkload({
        duration: 30,
        preset: 'heavy',
      });

      if (!workloadResult.completed || workloadResult.crashed) {
        result.crashes++;
        result.errorMessages.push('Stress test crashed or did not complete');
        logger.error('StabilityEngine', 'Stress test failed', workloadResult);
        return false;
      }

      // Check for throttling during stress test
      const history = this.telemetryCollector.getHistory(30000);

      const thermalThrottle = history.some(t =>
        t.throttleReasons.some(r => r === 'thermal' as any)
      );

      const powerThrottle = history.some(t =>
        t.throttleReasons.some(r => r === 'power' as any)
      );

      if (thermalThrottle) {
        result.thermalThrottle = true;
        result.errorMessages.push('Thermal throttling during stress test');
        logger.warn('StabilityEngine', 'Thermal throttling detected');
        return false;
      }

      if (powerThrottle) {
        result.powerThrottle = true;
        result.errorMessages.push('Power throttling during stress test');
        logger.warn('StabilityEngine', 'Power throttling detected');
        // Don't fail on power throttle, just warn
      }

      logger.info('StabilityEngine', 'Stress test passed');
      return true;
    } catch (error: any) {
      result.crashes++;
      result.errorMessages.push(`Stress test exception: ${error.message}`);
      logger.error('StabilityEngine', 'Stress test error', error);
      return false;
    }
  }

  /**
   * Layer 3: Run real workload test
   */
  private async runWorkloadTest(result: StabilityTestResult): Promise<boolean> {
    logger.info('StabilityEngine', 'Layer 3: Real Workload Test');

    this.telemetryCollector.clearHistory();

    try {
      // Run 20-second real workload
      const workloadResult = await this.workloadRunner.runWorkload({
        duration: 20,
        preset: 'medium',
      });

      if (!workloadResult.completed || workloadResult.crashed) {
        result.crashes++;
        result.errorMessages.push('Workload test crashed or did not complete');
        logger.error('StabilityEngine', 'Workload test failed', workloadResult);
        return false;
      }

      // Check frame time stability
      if (workloadResult.frameTimeStdDev > 10) {
        result.performanceRegression = true;
        result.errorMessages.push(
          `High frame time variance: ${workloadResult.frameTimeStdDev}ms`
        );
        logger.warn('StabilityEngine', 'Performance instability detected', {
          stdDev: workloadResult.frameTimeStdDev,
        });
        return false;
      }

      logger.info('StabilityEngine', 'Workload test passed');
      return true;
    } catch (error: any) {
      result.crashes++;
      result.errorMessages.push(`Workload test exception: ${error.message}`);
      logger.error('StabilityEngine', 'Workload test error', error);
      return false;
    }
  }

  /**
   * Layer 4: Analyze telemetry for stability issues
   */
  private async analyzeTelemetry(result: StabilityTestResult): Promise<boolean> {
    logger.info('StabilityEngine', 'Layer 4: Telemetry Analysis');

    const history = this.telemetryCollector.getHistory(60000); // Last 60 seconds

    if (history.length === 0) {
      result.errorMessages.push('No telemetry data available');
      logger.error('StabilityEngine', 'No telemetry data');
      return false;
    }

    // Check maximum temperature
    const maxTemp = Math.max(...history.map(t => t.temperature));
    if (maxTemp > 95) {
      result.thermalThrottle = true;
      result.errorMessages.push(`Maximum temperature too high: ${maxTemp}°C`);
      logger.error('StabilityEngine', 'Temperature limit exceeded', { maxTemp });
      return false;
    }

    // Check for clock instability (sudden drops)
    let clockDrops = 0;
    for (let i = 1; i < history.length; i++) {
      const clockDiff = history[i - 1].coreClock - history[i].coreClock;
      if (clockDiff > 200) {
        // More than 200 MHz drop
        clockDrops++;
      }
    }

    if (clockDrops > history.length * 0.05) {
      // More than 5% of samples
      result.performanceRegression = true;
      result.errorMessages.push(`Frequent clock drops detected: ${clockDrops} drops`);
      logger.warn('StabilityEngine', 'Clock instability detected', { clockDrops });
      return false;
    }

    // Check for power spikes
    const powerValues = history.map(t => t.powerDraw);
    const avgPower = powerValues.reduce((a, b) => a + b, 0) / powerValues.length;
    const powerSpikes = powerValues.filter(p => p > avgPower * 1.2).length;

    if (powerSpikes > history.length * 0.1) {
      logger.warn('StabilityEngine', 'Power instability detected', {
        powerSpikes,
        avgPower,
      });
      // Don't fail, just log
    }

    logger.info('StabilityEngine', 'Telemetry analysis passed', {
      maxTemp,
      clockDrops,
      powerSpikes,
    });

    return true;
  }

  /**
   * Layer 5: Check driver stability via Windows Event Log
   */
  private async checkDriverStability(result: StabilityTestResult): Promise<boolean> {
    logger.info('StabilityEngine', 'Layer 5: Driver Stability Check');

    try {
      // Check for driver reset in last 2 minutes
      const driverReset = await this.eventMonitor.checkDriverReset(2);

      if (driverReset) {
        result.driverReset = true;
        result.errorMessages.push('Driver reset detected in Windows Event Log');
        logger.error('StabilityEngine', 'Driver reset detected');
        return false;
      }

      // Check for application crashes
      const crashes = await this.eventMonitor.checkApplicationCrashes(2);

      if (crashes.length > 0) {
        result.crashes += crashes.length;
        result.errorMessages.push(`${crashes.length} application crashes detected`);
        logger.error('StabilityEngine', 'Application crashes detected', {
          count: crashes.length,
        });
        return false;
      }

      // Double-check GPU is still responsive
      try {
        await this.gpuInterface.getTelemetry();
      } catch {
        result.driverReset = true;
        result.errorMessages.push('GPU became unresponsive');
        logger.error('StabilityEngine', 'GPU unresponsive');
        return false;
      }

      logger.info('StabilityEngine', 'Driver stability check passed');
      return true;
    } catch (error) {
      result.errorMessages.push('Driver stability check failed');
      logger.error('StabilityEngine', 'Driver check error', error);
      return false;
    }
  }

  /**
   * Quick stability check (5-10 seconds)
   */
  async quickCheck(): Promise<boolean> {
    logger.info('StabilityEngine', 'Running quick stability check');

    try {
      // Quick 5-second test
      const stable = await this.workloadRunner.runQuickStabilityTest();

      if (!stable) {
        logger.warn('StabilityEngine', 'Quick check failed');
        return false;
      }

      // Check telemetry
      const history = this.telemetryCollector.getHistory(10000);
      const hasThrottling = history.some(
        t => t.throttleReasons.some(r => r !== 'none' as any)
      );

      const maxTemp = Math.max(...history.map(t => t.temperature));

      const result = !hasThrottling && maxTemp < 95;

      logger.info('StabilityEngine', 'Quick check completed', {
        stable: result,
        hasThrottling,
        maxTemp,
      });

      return result;
    } catch (error) {
      logger.error('StabilityEngine', 'Quick check failed', error);
      return false;
    }
  }

  /**
   * Rollback to known-good configuration
   */
  async rollback(): Promise<void> {
    if (!this.knownGoodConfig) {
      throw new Error('No known-good configuration available');
    }

    logger.warn('StabilityEngine', 'Rolling back to known-good configuration', {
      config: this.knownGoodConfig.name,
    });

    try {
      // Apply known-good configuration
      await this.gpuInterface.applyClockOffset(this.knownGoodConfig.clockOffset);
      await this.gpuInterface.setPowerLimit(this.knownGoodConfig.powerLimit);

      logger.info('StabilityEngine', 'Rollback completed successfully');
    } catch (error) {
      logger.error('StabilityEngine', 'Rollback failed', error);
      throw new Error(`Rollback failed: ${error}`);
    }
  }

  /**
   * Shutdown stability engine
   */
  shutdown(): void {
    this.eventMonitor.stop();
    this.workloadRunner.stop();
    logger.info('StabilityEngine', 'Shutdown complete');
  }
}
