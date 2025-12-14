/**
 * Benchmarking system for testing GPU configurations
 */

import { BenchmarkResult, TuningConfiguration } from '../types';
import { TelemetryCollector } from '../hardware/telemetry-collector';
import { logger } from '../utils/logger';

export class Benchmark {
  private telemetryCollector: TelemetryCollector;

  constructor(telemetryCollector: TelemetryCollector) {
    this.telemetryCollector = telemetryCollector;
  }

  /**
   * Run a benchmark for a given configuration
   */
  async run(config: TuningConfiguration, duration: number = 60): Promise<BenchmarkResult> {
    logger.info('Benchmark', `Starting benchmark for config: ${config.name}`, { duration });

    // Clear telemetry history before starting
    this.telemetryCollector.clearHistory();

    // Run the actual benchmark workload
    await this.runWorkload(duration);

    // Collect metrics
    const metrics = this.telemetryCollector.getAverageMetrics(duration * 1000);
    const history = this.telemetryCollector.getHistory(duration * 1000);

    // Calculate performance metrics
    const frameTimeStability = this.calculateFrameTimeStability(history);
    const powerEfficiency = metrics.avgUtilization / metrics.avgPowerDraw;
    const score = this.calculateScore(metrics, frameTimeStability, powerEfficiency);

    const result: BenchmarkResult = {
      configurationId: config.id,
      score,
      avgFps: metrics.avgUtilization * 1.5, // Approximation based on utilization
      frameTimeStability,
      powerEfficiency,
      avgTemperature: metrics.avgTemperature,
      maxTemperature: Math.max(...history.map(h => h.temperature)),
      avgPowerDraw: metrics.avgPowerDraw,
      stable: true,
      duration,
      timestamp: Date.now(),
    };

    logger.info('Benchmark', 'Benchmark completed', result);
    return result;
  }

  /**
   * Run a synthetic GPU workload
   */
  private async runWorkload(duration: number): Promise<void> {
    logger.info('Benchmark', 'Running synthetic workload', { duration });

    // In a real implementation, this would launch a GPU stress test
    // For MVP, we simulate by waiting and collecting telemetry
    // Could use tools like FurMark, 3DMark, or custom CUDA/OpenGL workload

    return new Promise((resolve) => {
      setTimeout(() => {
        logger.info('Benchmark', 'Workload completed');
        resolve();
      }, duration * 1000);
    });
  }

  /**
   * Calculate frame time stability (variance)
   * Lower is better
   */
  private calculateFrameTimeStability(history: any[]): number {
    if (history.length === 0) return 0;

    const utilizations = history.map(h => h.utilization.gpu);
    const mean = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
    const variance = utilizations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / utilizations.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate overall benchmark score
   * Higher is better
   */
  private calculateScore(
    metrics: any,
    frameTimeStability: number,
    powerEfficiency: number
  ): number {
    // Weighted scoring:
    // 50% performance (utilization as proxy)
    // 25% power efficiency
    // 15% thermal performance
    // 10% stability

    const performanceScore = metrics.avgUtilization * 0.5;
    const efficiencyScore = Math.min(powerEfficiency * 100, 50) * 0.25;
    const thermalScore = Math.max(0, (100 - metrics.avgTemperature)) * 0.15;
    const stabilityScore = Math.max(0, (20 - frameTimeStability)) * 0.5 * 0.10;

    return performanceScore + efficiencyScore + thermalScore + stabilityScore;
  }

  /**
   * Run a quick validation test (shorter than full benchmark)
   */
  async runQuickTest(config: TuningConfiguration): Promise<boolean> {
    logger.info('Benchmark', `Running quick test for config: ${config.name}`);

    try {
      this.telemetryCollector.clearHistory();
      await this.runWorkload(10); // 10 second test

      const history = this.telemetryCollector.getHistory(10000);

      // Check for basic stability
      const hasThrottling = history.some(h =>
        h.throttleReasons.some(r => r !== 'none' as any)
      );

      const maxTemp = Math.max(...history.map(h => h.temperature));
      const tempOK = maxTemp < 95;

      const stable = !hasThrottling && tempOK;

      logger.info('Benchmark', 'Quick test completed', {
        stable,
        hasThrottling,
        maxTemp,
      });

      return stable;
    } catch (error) {
      logger.error('Benchmark', 'Quick test failed', error);
      return false;
    }
  }
}
