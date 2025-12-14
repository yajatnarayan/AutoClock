/**
 * Production Optimization Engine
 * Real GPU tuning with constraint enforcement, adaptive steps, and safety
 */

import { EventEmitter } from 'events';
import {
  OptimizationMode,
  OptimizationGoal,
  OptimizationProgress,
  OptimizationStage,
  TuningConfiguration,
  BenchmarkResult,
} from '../types';
import { IGPUInterface, GPUCapabilities } from '../hardware/gpu-interface';
import { TelemetryService } from '../hardware/telemetry-service';
import { BenchmarkEngine } from '../benchmarking/benchmark-engine';
import { StabilityEngine } from '../stability/stability-engine';
import { StressTestEngine } from '../benchmarking/stress-test-engine';
import { logger } from '../utils/production-logger';

export class ProductionOptimizer extends EventEmitter {
  private gpuInterface: IGPUInterface;
  private telemetry: TelemetryService;
  private benchmark: BenchmarkEngine;
  private stability: StabilityEngine;
  private stressTest: StressTestEngine;
  private capabilities?: GPUCapabilities;
  private isOptimizing: boolean = false;
  private baselineConfig?: TuningConfiguration;
  private bestConfig?: TuningConfiguration;
  private bestScore: number = 0;
  private startTime?: number;
  private readonly isTestEnv: boolean =
    process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

  constructor(
    gpuInterface: IGPUInterface,
    telemetry: TelemetryService,
    stability: StabilityEngine
  ) {
    super();
    this.gpuInterface = gpuInterface;
    this.telemetry = telemetry;
    this.benchmark = new BenchmarkEngine(telemetry);
    this.stability = stability;
    this.stressTest = new StressTestEngine(telemetry, gpuInterface);

    // Forward stress test events
    this.stressTest.on('progress', (progress) => {
      this.emit('stress-progress', progress);
    });

    this.stressTest.on('critical-temperature', (temp) => {
      this.emit('critical-temperature', temp);
    });
  }

  /**
   * Run auto-optimization with production constraints
   */
  async optimize(mode: OptimizationMode): Promise<TuningConfiguration> {
    if (this.isOptimizing) {
      throw new Error('Optimization already in progress');
    }

    this.isOptimizing = true;
    this.startTime = Date.now();

    logger.info('ProductionOptimizer', 'Starting optimization', { mode });

    try {
      // Get GPU capabilities
      this.capabilities = await this.gpuInterface.getCapabilities();
      const limits = await this.gpuInterface.getLimits();

      // Create optimization goal with constraints
      const goal = this.createOptimizationGoal(mode, limits);

      // Stage 1: Initialize
      await this.emitProgress(OptimizationStage.INITIALIZING, 0, 6, 'Initializing optimization');
      await this.initialize();

      // Stage 2: Baseline
      await this.emitProgress(OptimizationStage.BASELINE, 1, 6, 'Running baseline benchmark');
      const baseline = await this.runBaseline();
      this.baselineConfig = baseline.config;
      this.bestConfig = baseline.config;
      this.bestScore = baseline.result.score;

      // Set known-good for rollback
      this.stability.setKnownGoodConfig(baseline.config);

      // Stage 3: Memory tuning (skip if clock control unsupported)
      await this.emitProgress(
        OptimizationStage.MEMORY_TUNING,
        2,
        6,
        this.capabilities.supportsClockOffset
          ? 'Optimizing memory clocks'
          : 'Skipping memory tuning (clock control unsupported)'
      );
      const memoryConfig = this.capabilities.supportsClockOffset
        ? await this.tuneMemory(goal)
        : baseline.config;

      // Check time budget (target: <10 min total)
      if (this.getElapsedMinutes() > 8) {
        logger.warn('ProductionOptimizer', 'Approaching time limit, skipping remaining stages');
        await this.emitProgress(OptimizationStage.COMPLETED, 6, 6, 'Optimization completed (time limited)');
        return memoryConfig;
      }

      // Stage 4: Core tuning (skip if clock control unsupported)
      await this.emitProgress(
        OptimizationStage.CORE_TUNING,
        3,
        6,
        this.capabilities.supportsClockOffset
          ? 'Optimizing core clocks'
          : 'Skipping core tuning (clock control unsupported)'
      );
      const coreConfig = this.capabilities.supportsClockOffset
        ? await this.tuneCore(memoryConfig, goal)
        : memoryConfig;

      if (this.getElapsedMinutes() > 9) {
        logger.warn('ProductionOptimizer', 'Approaching time limit, skipping power/fan tuning');
        await this.emitProgress(OptimizationStage.COMPLETED, 6, 6, 'Optimization completed (time limited)');
        return coreConfig;
      }

      // Stage 5: Power tuning
      await this.emitProgress(OptimizationStage.POWER_TUNING, 4, 6, 'Optimizing power limit');
      const powerConfig = await this.tunePower(coreConfig, goal);

      // Stage 6: Final validation with extreme stress test
      await this.emitProgress(OptimizationStage.VALIDATION, 5, 6, 'Final extreme stress test validation');

      // Run extreme stress test (60 seconds)
      const finalStressResult = await this.stressTest.runExtremeStressTest(
        this.testAdjustedDuration(60)
      );

      if (!finalStressResult.passed || finalStressResult.stabilityScore < 90) {
        logger.warn('ProductionOptimizer', 'Final stress test failed, using best previous config', {
          stabilityScore: finalStressResult.stabilityScore,
          issues: finalStressResult.issues,
        });
        await this.stability.rollback();
        await this.emitProgress(OptimizationStage.COMPLETED, 6, 6, 'Optimization completed (rolled back to safe config)');
        return this.bestConfig!;
      }

      logger.info('ProductionOptimizer', 'Final stress test passed', {
        stabilityScore: finalStressResult.stabilityScore,
        maxTemp: finalStressResult.maxTemperature,
        avgPower: finalStressResult.avgPowerDraw,
      });

      await this.emitProgress(OptimizationStage.COMPLETED, 6, 6, 'Optimization completed successfully');

      const improvement = ((this.bestScore - baseline.result.score) / baseline.result.score) * 100;
      logger.info('ProductionOptimizer', 'Optimization completed', {
        improvementPercent: improvement.toFixed(2),
        totalTimeMinutes: this.getElapsedMinutes().toFixed(2),
      });

      return powerConfig;
    } catch (error) {
      logger.error('ProductionOptimizer', 'Optimization failed', error);
      await this.emitProgress(OptimizationStage.FAILED, 0, 6, `Optimization failed: ${error}`);

      // Emergency rollback
      if (this.baselineConfig) {
        await this.stability.rollback();
      }

      throw error;
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Initialize optimization
   */
  private async initialize(): Promise<void> {
    // Reset to default clocks
    await this.gpuInterface.resetClocks();
    await this.gpuInterface.resetPowerLimit();

    // Ensure telemetry is running
    if (!this.telemetry.isActive()) {
      this.telemetry.start();
    }

    logger.info('ProductionOptimizer', 'Initialization complete');
  }

  /**
   * Run baseline benchmark
   */
  private async runBaseline(): Promise<{
    config: TuningConfiguration;
    result: BenchmarkResult;
  }> {
    const config: TuningConfiguration = {
      id: 'baseline',
      name: 'Baseline (Stock)',
      clockOffset: { core: 0, memory: 0 },
      powerLimit: 100,
      timestamp: Date.now(),
    };

    await this.applyConfiguration(config);

    const result = await this.benchmark.runBenchmark(config, this.testAdjustedDuration(30));

    logger.info('ProductionOptimizer', 'Baseline complete', { score: result.score });

    return { config, result };
  }

  /**
   * Tune memory clocks with adaptive stepping
   */
  private async tuneMemory(goal: OptimizationGoal): Promise<TuningConfiguration> {
    logger.info('ProductionOptimizer', 'Starting memory tuning');

    if (!this.capabilities) {
      throw new Error('GPU capabilities not initialized');
    }

    let currentOffset = 0;
    let step = this.isTestEnv ? 200 : 100; // Faster iteration under test
    const maxOffset = Math.min(
      this.isTestEnv ? 200 : 1500,
      this.capabilities.clockOffsetRange.memoryMax
    );
    let lastStableOffset = 0;
    let consecutiveFailures = 0;
    let iterations = 0;
    const maxIterations = this.isTestEnv ? 3 : Number.POSITIVE_INFINITY;

    while (currentOffset <= maxOffset && consecutiveFailures < 2 && iterations < maxIterations) {
      iterations++;
      const config: TuningConfiguration = {
        id: `memory-${currentOffset}`,
        name: `Memory +${currentOffset}MHz`,
        clockOffset: { core: 0, memory: currentOffset },
        powerLimit: 100,
        timestamp: Date.now(),
      };

      await this.applyConfiguration(config);

      // Quick stability check with stress test
      const stressResult = await this.stressTest.runStressTest({
        duration: this.testAdjustedDuration(15),
        intensity: 'medium',
        continuousMonitoring: true,
        maxTemperature: goal.maxTemperature || 90,
        allowThermalThrottle: false,
      });

      if (!stressResult.passed || stressResult.stabilityScore < 80) {
        logger.info('ProductionOptimizer', `Memory offset ${currentOffset} unstable under load`, {
          stabilityScore: stressResult.stabilityScore,
          issues: stressResult.issues,
        });
        consecutiveFailures++;

        // Reduce step size and try smaller increments
        if (step > 25) {
          step = Math.floor(step / 2);
          currentOffset = lastStableOffset + step;
          continue;
        } else {
          // Step size too small, stop
          break;
        }
      }

      consecutiveFailures = 0;

      // Full benchmark under stress
      const result = await this.benchmark.runBenchmark(config, this.testAdjustedDuration(20)); // Shorter for time budget

      if (result.score > this.bestScore) {
        this.bestScore = result.score;
        this.bestConfig = config;
        lastStableOffset = currentOffset;

        logger.info('ProductionOptimizer', `New best memory config: +${currentOffset}MHz`, {
          score: result.score,
          step,
        });

        // Increase step size if we're making progress
        if (step < 200 && currentOffset < maxOffset - 400) {
          step = Math.min(200, step * 2);
        }
      }

      currentOffset += step;

      // Check constraints
      if (this.getElapsedMinutes() > 5) {
        logger.warn('ProductionOptimizer', 'Memory tuning time limit reached');
        break;
      }
    }

    const finalConfig: TuningConfiguration = {
      id: 'memory-final',
      name: 'Memory Optimized',
      clockOffset: { core: 0, memory: lastStableOffset },
      powerLimit: 100,
      timestamp: Date.now(),
    };

    await this.applyConfiguration(finalConfig);
    logger.info('ProductionOptimizer', 'Memory tuning complete', { offset: lastStableOffset });

    return finalConfig;
  }

  /**
   * Tune core clocks with adaptive stepping
   */
  private async tuneCore(
    baseConfig: TuningConfiguration,
    goal: OptimizationGoal
  ): Promise<TuningConfiguration> {
    logger.info('ProductionOptimizer', 'Starting core tuning');

    if (!this.capabilities) {
      throw new Error('GPU capabilities not initialized');
    }

    let currentOffset = 0;
    let step = this.isTestEnv ? 100 : 50; // Faster iteration under test
    const maxOffset = Math.min(
      this.isTestEnv ? 100 : 300,
      this.capabilities.clockOffsetRange.coreMax
    );
    let lastStableOffset = 0;
    let consecutiveFailures = 0;
    let iterations = 0;
    const maxIterations = this.isTestEnv ? 3 : Number.POSITIVE_INFINITY;

    while (currentOffset <= maxOffset && consecutiveFailures < 2 && iterations < maxIterations) {
      iterations++;
      const config: TuningConfiguration = {
        id: `core-${currentOffset}`,
        name: `Core +${currentOffset}MHz`,
        clockOffset: {
          core: currentOffset,
          memory: baseConfig.clockOffset.memory,
        },
        powerLimit: baseConfig.powerLimit,
        timestamp: Date.now(),
      };

      await this.applyConfiguration(config);

      // Stress test core clocks under load
      const stressResult = await this.stressTest.runStressTest({
        duration: this.testAdjustedDuration(15),
        intensity: 'heavy',
        continuousMonitoring: true,
        maxTemperature: goal.maxTemperature || 90,
        allowThermalThrottle: false,
      });

      if (!stressResult.passed || stressResult.stabilityScore < 85) {
        logger.info('ProductionOptimizer', `Core offset ${currentOffset} unstable under stress`, {
          stabilityScore: stressResult.stabilityScore,
          issues: stressResult.issues,
        });
        consecutiveFailures++;

        if (step > 12) {
          step = Math.floor(step / 2);
          currentOffset = lastStableOffset + step;
          continue;
        } else {
          break;
        }
      }

      consecutiveFailures = 0;

      const result = await this.benchmark.runBenchmark(config, this.testAdjustedDuration(20));

      if (result.score > this.bestScore) {
        this.bestScore = result.score;
        this.bestConfig = config;
        lastStableOffset = currentOffset;

        logger.info('ProductionOptimizer', `New best core config: +${currentOffset}MHz`, {
          score: result.score,
        });
      }

      currentOffset += step;

      if (this.getElapsedMinutes() > 8) {
        logger.warn('ProductionOptimizer', 'Core tuning time limit reached');
        break;
      }
    }

    const finalConfig: TuningConfiguration = {
      ...baseConfig,
      id: 'core-final',
      name: 'Core Optimized',
      clockOffset: {
        core: lastStableOffset,
        memory: baseConfig.clockOffset.memory,
      },
      timestamp: Date.now(),
    };

    await this.applyConfiguration(finalConfig);
    logger.info('ProductionOptimizer', 'Core tuning complete', { offset: lastStableOffset });

    return finalConfig;
  }

  /**
   * Tune power limit
   */
  private async tunePower(
    baseConfig: TuningConfiguration,
    goal: OptimizationGoal
  ): Promise<TuningConfiguration> {
    logger.info('ProductionOptimizer', 'Starting power tuning');

    if (!this.capabilities) {
      throw new Error('GPU capabilities not initialized');
    }

    const powerRange = this.capabilities.powerLimitRange;
    let optimalPower = powerRange.default;

    // Mode-specific power strategies
    if (goal.mode === OptimizationMode.MAX_PERFORMANCE) {
      optimalPower = Math.min(powerRange.max, powerRange.default * 1.10);
    } else if (goal.mode === OptimizationMode.QUIET) {
      optimalPower = Math.max(powerRange.min, powerRange.default * 0.85);
    } else {
      // Balanced: Find efficiency sweet spot
      const powerLevels = [
        powerRange.default * 0.90,
        powerRange.default * 0.95,
        powerRange.default,
        powerRange.default * 1.05,
      ].filter(p => p >= powerRange.min && p <= powerRange.max);

      let bestEfficiency = 0;

      for (const power of powerLevels) {
        const config = { ...baseConfig, powerLimit: power };
        await this.applyConfiguration(config);

        const result = await this.benchmark.runBenchmark(config, this.testAdjustedDuration(15)); // Short test
        const efficiency = result.powerEfficiency;

        if (efficiency > bestEfficiency) {
          bestEfficiency = efficiency;
          optimalPower = power;
        }

        if (this.getElapsedMinutes() > 9.5) {
          break;
        }
      }
    }

    const finalConfig: TuningConfiguration = {
      ...baseConfig,
      id: 'power-final',
      name: `Optimized (${goal.mode})`,
      powerLimit: optimalPower,
      timestamp: Date.now(),
    };

    await this.applyConfiguration(finalConfig);
    logger.info('ProductionOptimizer', 'Power tuning complete', { powerLimit: optimalPower });

    return finalConfig;
  }

  /**
   * Apply configuration to GPU
   */
  private async applyConfiguration(config: TuningConfiguration): Promise<void> {
    await this.gpuInterface.applyClockOffset(config.clockOffset);
    await this.gpuInterface.setPowerLimit(config.powerLimit);
    // TODO: Apply fan curve when NVAPI support added
  }

  /**
   * Create optimization goal with enforced constraints
   */
  private createOptimizationGoal(mode: OptimizationMode, limits: any): OptimizationGoal {
    const goals: { [key in OptimizationMode]: OptimizationGoal } = {
      [OptimizationMode.MAX_PERFORMANCE]: {
        mode,
        maxTemperature: Math.min(90, limits.maxTemperature),
        maxPowerDraw: limits.maxPowerDraw,
        maxFanSpeed: 100,
      },
      [OptimizationMode.BALANCED]: {
        mode,
        maxTemperature: Math.min(80, limits.maxTemperature),
        maxPowerDraw: limits.maxPowerDraw * 0.95,
        maxFanSpeed: 80,
        targetEfficiency: 0.5,
      },
      [OptimizationMode.QUIET]: {
        mode,
        maxTemperature: Math.min(75, limits.maxTemperature),
        maxPowerDraw: limits.maxPowerDraw * 0.85,
        maxFanSpeed: 60,
      },
    };

    return goals[mode];
  }

  /**
   * Get elapsed time in minutes
   */
  private getElapsedMinutes(): number {
    if (!this.startTime) return 0;
    return (Date.now() - this.startTime) / 60000;
  }

  /**
   * Emit optimization progress event
   */
  private async emitProgress(
    stage: OptimizationStage,
    step: number,
    total: number,
    message: string
  ): Promise<void> {
    const progress: OptimizationProgress = {
      stage,
      currentStep: step,
      totalSteps: total,
      message,
      bestConfig: this.bestConfig,
      bestScore: this.bestScore,
    };

    this.emit('progress', progress);
    logger.debug('ProductionOptimizer', `Progress: ${message}`, progress);
  }

  /**
   * Check if optimization is running
   */
  isRunning(): boolean {
    return this.isOptimizing;
  }

  private testAdjustedDuration(seconds: number): number {
    return this.isTestEnv ? Math.min(seconds, 1) : seconds;
  }
}
