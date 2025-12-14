/**
 * Production Benchmark Engine
 * Real GPU benchmarking with workload execution and frame time analysis
 */

import { BenchmarkResult, TuningConfiguration } from '../types';
import { TelemetryService } from '../hardware/telemetry-service';
import { WorkloadRunner, WorkloadResult } from './workload-runner';
import { logger } from '../utils/logger';

export class BenchmarkEngine {
  private telemetryCollector: TelemetryService;
  private workloadRunner: WorkloadRunner;

  constructor(telemetryCollector: TelemetryService) {
    this.telemetryCollector = telemetryCollector;
    this.workloadRunner = new WorkloadRunner();
  }

  /**
   * Run a full benchmark for a configuration
   */
  async runBenchmark(
    config: TuningConfiguration,
    duration: number = 30
  ): Promise<BenchmarkResult> {
    logger.info('BenchmarkEngine', `Starting benchmark for: ${config.name}`, { duration });

    // Clear telemetry history
    this.telemetryCollector.clearHistory();

    const startTime = Date.now();

    try {
      // Run the actual GPU workload
      const workloadResult = await this.workloadRunner.runWorkload({
        duration,
        preset: 'medium',
        api: 'dx11',
      });

      // Collect telemetry metrics
      const telemetryHistory = this.telemetryCollector.getHistory(duration * 1000);
      const avgMetrics = this.telemetryCollector.getAverageMetrics(duration * 1000);

      // Calculate performance score
      const score = this.calculateScore(workloadResult, avgMetrics, telemetryHistory);

      const result: BenchmarkResult = {
        configurationId: config.id,
        score,
        avgFps: workloadResult.avgFps,
        frameTimeStability: workloadResult.frameTimeStdDev,
        powerEfficiency: this.calculatePowerEfficiency(
          workloadResult.avgFps,
          avgMetrics.avgPowerDraw
        ),
        avgTemperature: avgMetrics.avgTemperature,
        maxTemperature: Math.max(...telemetryHistory.map(t => t.temperature)),
        avgPowerDraw: avgMetrics.avgPowerDraw,
        stable: workloadResult.completed && !workloadResult.crashed,
        duration: workloadResult.duration,
        timestamp: startTime,
      };

      logger.info('BenchmarkEngine', 'Benchmark completed', result);
      return result;
    } catch (error) {
      logger.error('BenchmarkEngine', 'Benchmark failed', error);

      // Return failed result
      return {
        configurationId: config.id,
        score: 0,
        avgFps: 0,
        frameTimeStability: 999,
        powerEfficiency: 0,
        avgTemperature: 0,
        maxTemperature: 0,
        avgPowerDraw: 0,
        stable: false,
        duration: (Date.now() - startTime) / 1000,
        timestamp: startTime,
      };
    }
  }

  /**
   * Run a quick validation test (shorter duration)
   */
  async runQuickTest(config: TuningConfiguration): Promise<boolean> {
    logger.info('BenchmarkEngine', `Running quick test for: ${config.name}`);

    this.telemetryCollector.clearHistory();

    try {
      // Run 10-second test
      const stable = await this.workloadRunner.runQuickStabilityTest();

      if (!stable) {
        logger.warn('BenchmarkEngine', 'Quick test indicated instability');
        return false;
      }

      // Check telemetry for issues
      const history = this.telemetryCollector.getHistory(10000);

      // Check for throttling
      const hasThrottling = history.some(
        t => t.throttleReasons.length > 0 && !t.throttleReasons.includes('none' as any)
      );

      // Check for high temperature
      const maxTemp = Math.max(...history.map(t => t.temperature));
      const tempOK = maxTemp < 95;

      const result = !hasThrottling && tempOK;

      logger.info('BenchmarkEngine', 'Quick test completed', {
        stable: result,
        hasThrottling,
        maxTemp,
      });

      return result;
    } catch (error) {
      logger.error('BenchmarkEngine', 'Quick test failed', error);
      return false;
    }
  }

  /**
   * Calculate overall benchmark score
   * Weighted combination of FPS, stability, efficiency, and thermals
   */
  private calculateScore(
    workload: WorkloadResult,
    avgMetrics: any,
    telemetryHistory: any[]
  ): number {
    // Weight factors
    const FPS_WEIGHT = 0.4;
    const STABILITY_WEIGHT = 0.2;
    const EFFICIENCY_WEIGHT = 0.2;
    const THERMAL_WEIGHT = 0.2;

    // FPS score (normalized to 100)
    const fpsScore = Math.min(100, (workload.avgFps / 144) * 100);

    // Stability score (lower frame time variance is better)
    const stabilityScore = Math.max(
      0,
      100 - workload.frameTimeStdDev * 10
    );

    // Power efficiency score
    const efficiency = workload.avgFps / Math.max(1, avgMetrics.avgPowerDraw);
    const efficiencyScore = Math.min(100, efficiency * 50);

    // Thermal score (cooler is better)
    const thermalScore = Math.max(
      0,
      100 - avgMetrics.avgTemperature
    );

    // Throttle penalty (avoid "fast but constantly throttling" configs)
    const throttleRatio =
      telemetryHistory.length === 0
        ? 0
        : telemetryHistory.filter((t) => {
            const reasons = t?.throttleReasons;
            return Array.isArray(reasons) && reasons.some((r) => r !== 'none');
          }).length / telemetryHistory.length;
    const throttlePenalty = Math.min(20, throttleRatio * 100 * 0.2); // up to 20 points

    const totalScore =
      fpsScore * FPS_WEIGHT +
      stabilityScore * STABILITY_WEIGHT +
      efficiencyScore * EFFICIENCY_WEIGHT +
      thermalScore * THERMAL_WEIGHT -
      throttlePenalty;

    return Math.round(totalScore * 10) / 10;
  }

  /**
   * Calculate power efficiency (FPS per watt)
   */
  private calculatePowerEfficiency(fps: number, powerDraw: number): number {
    if (powerDraw === 0) return 0;
    return fps / powerDraw;
  }

  /**
   * Stop any running benchmark
   */
  stop(): void {
    this.workloadRunner.stop();
  }

  /**
   * Check if benchmark tools are available
   */
  async checkAvailability(): Promise<boolean> {
    const availability = await this.workloadRunner.checkAvailability();
    const hasAny = availability.furMark || availability.heaven || availability.compute;

    logger.info('BenchmarkEngine', 'Benchmark tool availability', availability);

    return hasAny;
  }
}
