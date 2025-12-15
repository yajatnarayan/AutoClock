/**
 * Auto-tuning optimization engine
 * Implements stepwise coordinate optimization for GPU tuning
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
import { NvidiaAPI } from '../hardware/nvidia-api';
import { TelemetryCollector } from '../hardware/telemetry-collector';
import { Benchmark } from './benchmark';
import { StabilityValidator } from '../stability/validator';
import { logger } from '../utils/production-logger';

export class Optimizer extends EventEmitter {
  private nvapi: NvidiaAPI;
  private telemetry: TelemetryCollector;
  private benchmark: Benchmark;
  private validator: StabilityValidator;
  private isOptimizing: boolean;
  private baselineConfig?: TuningConfiguration;
  private bestConfig?: TuningConfiguration;
  private bestScore: number;

  constructor(
    nvapi: NvidiaAPI,
    telemetry: TelemetryCollector,
    validator: StabilityValidator
  ) {
    super();
    this.nvapi = nvapi;
    this.telemetry = telemetry;
    this.benchmark = new Benchmark(telemetry);
    this.validator = validator;
    this.isOptimizing = false;
    this.bestScore = 0;
  }

  /**
   * Run auto-optimization for a given mode
   */
  async optimize(mode: OptimizationMode): Promise<TuningConfiguration> {
    if (this.isOptimizing) {
      throw new Error('Optimization already in progress');
    }

    this.isOptimizing = true;
    logger.info('Optimizer', 'Starting optimization', { mode });

    try {
      // Define optimization goal
      const goal = this.createOptimizationGoal(mode);

      // Stage 1: Initialize and baseline
      await this.emitProgress(OptimizationStage.INITIALIZING, 0, 6, 'Initializing optimization');
      await this.initialize();

      await this.emitProgress(OptimizationStage.BASELINE, 1, 6, 'Running baseline benchmark');
      const baseline = await this.runBaseline();
      this.baselineConfig = baseline.config;
      this.bestConfig = baseline.config;
      this.bestScore = baseline.result.score;

      // Stage 2: Memory tuning
      await this.emitProgress(OptimizationStage.MEMORY_TUNING, 2, 6, 'Optimizing memory clocks');
      const memoryConfig = await this.tuneMemory(goal);

      // Stage 3: Core tuning
      await this.emitProgress(OptimizationStage.CORE_TUNING, 3, 6, 'Optimizing core clocks');
      const coreConfig = await this.tuneCore(memoryConfig, goal);

      // Stage 4: Power tuning
      await this.emitProgress(OptimizationStage.POWER_TUNING, 4, 6, 'Optimizing power limit');
      const powerConfig = await this.tunePower(coreConfig, goal);

      // Stage 5: Fan tuning
      await this.emitProgress(OptimizationStage.FAN_TUNING, 5, 6, 'Optimizing fan curve');
      const finalConfig = await this.tuneFan(powerConfig, goal);

      // Stage 6: Final validation
      await this.emitProgress(OptimizationStage.VALIDATION, 6, 6, 'Final validation');
      const validated = await this.validator.validate(finalConfig);

      if (!validated.passed) {
        logger.warn('Optimizer', 'Final validation failed, using best previous config');
        await this.emitProgress(OptimizationStage.COMPLETED, 6, 6, 'Optimization completed (reverted to safe config)');
        return this.bestConfig!;
      }

      await this.emitProgress(OptimizationStage.COMPLETED, 6, 6, 'Optimization completed successfully');
      logger.info('Optimizer', 'Optimization completed successfully', {
        improvementPercent: ((this.bestScore - baseline.result.score) / baseline.result.score) * 100,
      });

      return finalConfig;
    } catch (error) {
      logger.error('Optimizer', 'Optimization failed', error);
      await this.emitProgress(OptimizationStage.FAILED, 0, 6, `Optimization failed: ${error}`);

      // Rollback to baseline
      if (this.baselineConfig) {
        await this.applyConfiguration(this.baselineConfig);
      }

      throw error;
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Initialize optimization process
   */
  private async initialize(): Promise<void> {
    // Reset to default clocks
    await this.nvapi.resetClocks();

    // Start telemetry if not already running
    if (!this.telemetry.isActive()) {
      this.telemetry.start();
    }

    logger.info('Optimizer', 'Initialization complete');
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
    const result = await this.benchmark.run(config, 30);

    logger.info('Optimizer', 'Baseline benchmark complete', {
      score: result.score,
    });

    return { config, result };
  }

  /**
   * Tune memory clocks
   */
  private async tuneMemory(_goal: OptimizationGoal): Promise<TuningConfiguration> {
    logger.info('Optimizer', 'Starting memory tuning');

    let currentOffset = 0;
    const step = 50; // MHz
    const maxOffset = 1500; // MHz
    let lastStableOffset = 0;

    while (currentOffset <= maxOffset) {
      const config: TuningConfiguration = {
        id: `memory-${currentOffset}`,
        name: `Memory +${currentOffset}MHz`,
        clockOffset: { core: 0, memory: currentOffset },
        powerLimit: 100,
        timestamp: Date.now(),
      };

      await this.applyConfiguration(config);

      // Quick stability test
      const stable = await this.benchmark.runQuickTest(config);

      if (!stable) {
        logger.info('Optimizer', `Memory offset ${currentOffset} unstable, stopping`);
        break;
      }

      // Full benchmark
      const result = await this.benchmark.run(config, 30);

      if (result.score > this.bestScore) {
        this.bestScore = result.score;
        this.bestConfig = config;
        lastStableOffset = currentOffset;
        logger.info('Optimizer', `New best memory config: +${currentOffset}MHz`, {
          score: result.score,
        });
      }

      currentOffset += step;
    }

    const finalConfig: TuningConfiguration = {
      id: `memory-final`,
      name: `Memory Optimized`,
      clockOffset: { core: 0, memory: lastStableOffset },
      powerLimit: 100,
      timestamp: Date.now(),
    };

    await this.applyConfiguration(finalConfig);
    logger.info('Optimizer', 'Memory tuning complete', { offset: lastStableOffset });

    return finalConfig;
  }

  /**
   * Tune core clocks
   */
  private async tuneCore(
    baseConfig: TuningConfiguration,
    _goal: OptimizationGoal
  ): Promise<TuningConfiguration> {
    logger.info('Optimizer', 'Starting core tuning');

    let currentOffset = 0;
    const step = 25; // MHz
    const maxOffset = 300; // MHz
    let lastStableOffset = 0;

    while (currentOffset <= maxOffset) {
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

      const stable = await this.benchmark.runQuickTest(config);

      if (!stable) {
        logger.info('Optimizer', `Core offset ${currentOffset} unstable, stopping`);
        break;
      }

      const result = await this.benchmark.run(config, 30);

      if (result.score > this.bestScore) {
        this.bestScore = result.score;
        this.bestConfig = config;
        lastStableOffset = currentOffset;
        logger.info('Optimizer', `New best core config: +${currentOffset}MHz`, {
          score: result.score,
        });
      }

      currentOffset += step;
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
    logger.info('Optimizer', 'Core tuning complete', { offset: lastStableOffset });

    return finalConfig;
  }

  /**
   * Tune power limit
   */
  private async tunePower(
    baseConfig: TuningConfiguration,
    goal: OptimizationGoal
  ): Promise<TuningConfiguration> {
    logger.info('Optimizer', 'Starting power tuning');

    // For balanced mode, try to find optimal power/performance ratio
    // For max performance, max out power
    // For quiet mode, reduce power

    let optimalPower = 100;

    if (goal.mode === OptimizationMode.MAX_PERFORMANCE) {
      optimalPower = 110; // +10% if supported
    } else if (goal.mode === OptimizationMode.QUIET) {
      optimalPower = 80; // -20%
    } else {
      // Balanced: Find sweet spot
      const powerLevels = [90, 95, 100, 105, 110];
      let bestEfficiency = 0;

      for (const power of powerLevels) {
        const config = { ...baseConfig, powerLimit: power };
        await this.applyConfiguration(config);

        const result = await this.benchmark.run(config, 30);
        const efficiency = result.powerEfficiency;

        if (efficiency > bestEfficiency) {
          bestEfficiency = efficiency;
          optimalPower = power;
        }
      }
    }

    const finalConfig: TuningConfiguration = {
      ...baseConfig,
      id: 'power-final',
      name: 'Power Optimized',
      powerLimit: optimalPower,
      timestamp: Date.now(),
    };

    await this.applyConfiguration(finalConfig);
    logger.info('Optimizer', 'Power tuning complete', { powerLimit: optimalPower });

    return finalConfig;
  }

  /**
   * Tune fan curve
   */
  private async tuneFan(
    baseConfig: TuningConfiguration,
    goal: OptimizationGoal
  ): Promise<TuningConfiguration> {
    logger.info('Optimizer', 'Starting fan tuning');

    // Simple fan curve based on mode
    // In a full implementation, this would create a custom curve

    const finalConfig: TuningConfiguration = {
      ...baseConfig,
      id: 'final-optimized',
      name: `Optimized (${goal.mode})`,
      fanCurve: this.createFanCurve(goal.mode),
      timestamp: Date.now(),
    };

    logger.info('Optimizer', 'Fan tuning complete');

    return finalConfig;
  }

  /**
   * Apply a configuration to the GPU
   */
  private async applyConfiguration(config: TuningConfiguration): Promise<void> {
    await this.nvapi.applyClockOffset(config.clockOffset);
    await this.nvapi.setPowerLimit(config.powerLimit);
    // Fan curve would be applied here if supported
  }

  /**
   * Create optimization goal based on mode
   */
  private createOptimizationGoal(mode: OptimizationMode): OptimizationGoal {
    const goals: { [key in OptimizationMode]: OptimizationGoal } = {
      [OptimizationMode.MAX_PERFORMANCE]: {
        mode,
        maxTemperature: 90,
        maxPowerDraw: 999,
        maxFanSpeed: 100,
      },
      [OptimizationMode.BALANCED]: {
        mode,
        maxTemperature: 80,
        maxPowerDraw: 300,
        maxFanSpeed: 80,
        targetEfficiency: 0.5,
      },
      [OptimizationMode.QUIET]: {
        mode,
        maxTemperature: 75,
        maxPowerDraw: 250,
        maxFanSpeed: 60,
      },
    };

    return goals[mode];
  }

  /**
   * Create fan curve based on mode
   */
  private createFanCurve(mode: OptimizationMode) {
    // Default curves for each mode
    const curves = {
      [OptimizationMode.MAX_PERFORMANCE]: [
        { temperature: 30, fanSpeed: 40 },
        { temperature: 50, fanSpeed: 60 },
        { temperature: 70, fanSpeed: 80 },
        { temperature: 80, fanSpeed: 100 },
      ],
      [OptimizationMode.BALANCED]: [
        { temperature: 30, fanSpeed: 30 },
        { temperature: 50, fanSpeed: 50 },
        { temperature: 70, fanSpeed: 70 },
        { temperature: 80, fanSpeed: 90 },
      ],
      [OptimizationMode.QUIET]: [
        { temperature: 30, fanSpeed: 20 },
        { temperature: 50, fanSpeed: 35 },
        { temperature: 70, fanSpeed: 50 },
        { temperature: 80, fanSpeed: 70 },
      ],
    };

    return curves[mode];
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
    logger.debug('Optimizer', `Progress: ${message}`, progress);
  }

  /**
   * Check if optimization is running
   */
  isRunning(): boolean {
    return this.isOptimizing;
  }
}
