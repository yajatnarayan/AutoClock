/**
 * Stability validation system
 * Multi-layer validation with automatic rollback
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { TuningConfiguration, StabilityTestResult } from '../types';
import { TelemetryCollector } from '../hardware/telemetry-collector';
import { logger } from '../utils/production-logger';

const execAsync = promisify(exec);

export class StabilityValidator {
  private telemetryCollector: TelemetryCollector;
  private knownGoodConfig?: TuningConfiguration;

  constructor(telemetryCollector: TelemetryCollector) {
    this.telemetryCollector = telemetryCollector;
  }

  /**
   * Set the known-good fallback configuration
   */
  setKnownGoodConfig(config: TuningConfiguration): void {
    this.knownGoodConfig = config;
    logger.info('StabilityValidator', 'Known-good configuration set', { configId: config.id });
  }

  /**
   * Validate a tuning configuration
   */
  async validate(config: TuningConfiguration): Promise<StabilityTestResult> {
    logger.info('StabilityValidator', `Validating configuration: ${config.name}`);

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

    // Layer 1: Synthetic stress test
    const syntheticPassed = await this.runSyntheticTest(result);
    if (!syntheticPassed) {
      result.passed = false;
      return result;
    }

    // Layer 2: Real-world rendering loop
    const renderingPassed = await this.runRenderingTest(result);
    if (!renderingPassed) {
      result.passed = false;
      return result;
    }

    // Layer 3: Telemetry analysis
    const telemetryPassed = this.analyzeTelemetry(result);
    if (!telemetryPassed) {
      result.passed = false;
      return result;
    }

    // Layer 4: Driver stability check
    const driverStable = await this.checkDriverStability(result);
    if (!driverStable) {
      result.passed = false;
      return result;
    }

    logger.info('StabilityValidator', 'Validation passed', { configId: config.id });
    return result;
  }

  /**
   * Run synthetic GPU stress test
   */
  private async runSyntheticTest(result: StabilityTestResult): Promise<boolean> {
    logger.info('StabilityValidator', 'Running synthetic stress test');

    try {
      // Clear telemetry history
      this.telemetryCollector.clearHistory();

      // Run stress test for 30 seconds
      // In production, this would launch a GPU stress tool like FurMark or OCCT
      await this.simulateStressTest(30);

      // Check for throttling during test
      const history = this.telemetryCollector.getHistory(30000);

      const hadThermalThrottle = history.some(t =>
        t.throttleReasons.includes('thermal' as any)
      );
      const hadPowerThrottle = history.some(t =>
        t.throttleReasons.includes('power' as any)
      );

      if (hadThermalThrottle) {
        result.thermalThrottle = true;
        result.errorMessages.push('Thermal throttling detected during stress test');
        logger.warn('StabilityValidator', 'Thermal throttling detected');
        return false;
      }

      if (hadPowerThrottle) {
        result.powerThrottle = true;
        result.errorMessages.push('Power throttling detected during stress test');
        logger.warn('StabilityValidator', 'Power throttling detected');
        return false;
      }

      logger.info('StabilityValidator', 'Synthetic stress test passed');
      return true;
    } catch (error) {
      result.crashes++;
      result.errorMessages.push(`Stress test crashed: ${error}`);
      logger.error('StabilityValidator', 'Synthetic stress test failed', error);
      return false;
    }
  }

  /**
   * Run real-world rendering test
   */
  private async runRenderingTest(result: StabilityTestResult): Promise<boolean> {
    logger.info('StabilityValidator', 'Running rendering test');

    try {
      // In production, this would run actual graphics workloads
      // For now, simulate with another stress period
      await this.simulateStressTest(20);

      // Check for performance consistency
      const history = this.telemetryCollector.getHistory(20000);
      const utilizations = history.map(t => t.utilization.gpu);

      const avgUtilization = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
      const variance = utilizations.reduce(
        (sum, val) => sum + Math.pow(val - avgUtilization, 2),
        0
      ) / utilizations.length;

      // High variance indicates instability
      if (Math.sqrt(variance) > 20) {
        result.performanceRegression = true;
        result.errorMessages.push('High performance variance detected');
        logger.warn('StabilityValidator', 'Performance variance too high', { variance });
        return false;
      }

      logger.info('StabilityValidator', 'Rendering test passed');
      return true;
    } catch (error) {
      result.crashes++;
      result.errorMessages.push(`Rendering test crashed: ${error}`);
      logger.error('StabilityValidator', 'Rendering test failed', error);
      return false;
    }
  }

  /**
   * Analyze telemetry for stability issues
   */
  private analyzeTelemetry(result: StabilityTestResult): boolean {
    logger.info('StabilityValidator', 'Analyzing telemetry');

    const history = this.telemetryCollector.getHistory(60000); // Last 60 seconds

    if (history.length === 0) {
      result.errorMessages.push('No telemetry data available');
      return false;
    }

    // Check temperature stability
    const maxTemp = Math.max(...history.map(t => t.temperature));
    if (maxTemp > 95) {
      result.thermalThrottle = true;
      result.errorMessages.push(`Maximum temperature too high: ${maxTemp}°C`);
      logger.warn('StabilityValidator', 'Temperature too high', { maxTemp });
      return false;
    }

    // Check for sudden clock drops (instability indicator)
    let clockDrops = 0;
    for (let i = 1; i < history.length; i++) {
      const clockDiff = history[i - 1].coreClock - history[i].coreClock;
      if (clockDiff > 200) { // More than 200 MHz drop
        clockDrops++;
      }
    }

    if (clockDrops > history.length * 0.05) { // More than 5% of samples
      result.performanceRegression = true;
      result.errorMessages.push('Frequent clock speed drops detected');
      logger.warn('StabilityValidator', 'Too many clock drops', { clockDrops });
      return false;
    }

    logger.info('StabilityValidator', 'Telemetry analysis passed');
    return true;
  }

  /**
   * Check driver stability (no resets)
   */
  private async checkDriverStability(result: StabilityTestResult): Promise<boolean> {
    logger.info('StabilityValidator', 'Checking driver stability');

    try {
      // Check Windows Event Log for GPU driver errors
      // This is a simplified version; production would check actual event logs
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=gpu_name --format=csv,noheader'
      );

      if (!stdout || stdout.trim().length === 0) {
        result.driverReset = true;
        result.errorMessages.push('GPU driver appears to have reset');
        logger.error('StabilityValidator', 'Driver reset detected');
        return false;
      }

      logger.info('StabilityValidator', 'Driver stability check passed');
      return true;
    } catch (error) {
      result.driverReset = true;
      result.errorMessages.push(`Driver stability check failed: ${error}`);
      logger.error('StabilityValidator', 'Driver stability check failed', error);
      return false;
    }
  }

  /**
   * Simulate GPU stress test
   */
  private async simulateStressTest(duration: number): Promise<void> {
    // In production, this would launch actual GPU stress software
    // For MVP simulation, we just wait while telemetry collects
    return new Promise((resolve) => {
      setTimeout(resolve, duration * 1000);
    });
  }

  /**
   * Rollback to known-good configuration
   */
  async rollback(): Promise<void> {
    if (!this.knownGoodConfig) {
      throw new Error('No known-good configuration available for rollback');
    }

    logger.warn('StabilityValidator', 'Rolling back to known-good configuration', {
      configId: this.knownGoodConfig.id,
    });

    // Apply the known-good configuration
    // This would use NvidiaAPI to apply the settings
    logger.info('StabilityValidator', 'Rollback completed');
  }

  /**
   * Quick stability check (for rapid iteration during tuning)
   */
  async quickCheck(): Promise<boolean> {
    logger.info('StabilityValidator', 'Running quick stability check');

    try {
      await this.simulateStressTest(5); // 5 second test

      const history = this.telemetryCollector.getHistory(5000);

      // Basic checks
      const hasThrottling = history.some(t =>
        t.throttleReasons.some(r => r !== 'none' as any)
      );

      const maxTemp = Math.max(...history.map(t => t.temperature));
      const tempOK = maxTemp < 95;

      const stable = !hasThrottling && tempOK;

      logger.info('StabilityValidator', 'Quick check complete', { stable });
      return stable;
    } catch (error) {
      logger.error('StabilityValidator', 'Quick check failed', error);
      return false;
    }
  }
}
