/**
 * Core type definitions for AutoOC backend
 */

export interface GPUInfo {
  id: string;
  name: string;
  vendor: 'NVIDIA' | 'AMD' | 'Intel';
  architecture: string;
  driverVersion: string;
  vramSize: number; // MB
  vramType: string;
  busInterface: string;
  powerLimit: {
    default: number; // Watts
    min: number;
    max: number;
    current: number;
  };
  thermalLimit: number; // Celsius
  boost: boolean;
}

export interface GPUTelemetry {
  timestamp: number;
  coreClock: number; // MHz
  memoryClock: number; // MHz
  powerDraw: number; // Watts
  temperature: number; // Celsius
  hotspotTemperature?: number; // Celsius
  fanSpeed: number; // Percentage (0-100)
  utilization: {
    gpu: number; // Percentage (0-100)
    memory: number; // Percentage (0-100)
    encoder?: number;
    decoder?: number;
  };
  throttleReasons: ThrottleReason[];
  voltage?: number; // mV
}

export enum ThrottleReason {
  NONE = 'none',
  THERMAL = 'thermal',
  POWER = 'power',
  VOLTAGE = 'voltage',
  RELIABILITY_VOLTAGE = 'reliability_voltage',
  SOFTWARE = 'software',
}

export interface ClockOffset {
  core: number; // MHz offset
  memory: number; // MHz offset
}

export interface TuningConfiguration {
  id: string;
  name: string;
  clockOffset: ClockOffset;
  powerLimit: number; // Percentage (0-100)
  fanCurve?: FanCurvePoint[];
  timestamp: number;
}

export interface FanCurvePoint {
  temperature: number; // Celsius
  fanSpeed: number; // Percentage (0-100)
}

export enum OptimizationMode {
  MAX_PERFORMANCE = 'max_performance',
  BALANCED = 'balanced',
  QUIET = 'quiet',
}

export interface OptimizationGoal {
  mode: OptimizationMode;
  maxTemperature: number;
  maxPowerDraw: number;
  maxFanSpeed: number;
  targetEfficiency?: number; // Performance per watt
}

export interface BenchmarkResult {
  configurationId: string;
  score: number;
  avgFps?: number;
  frameTimeStability: number; // Lower is better
  powerEfficiency: number; // FPS per watt
  avgTemperature: number;
  maxTemperature: number;
  avgPowerDraw: number;
  stable: boolean;
  duration: number; // seconds
  timestamp: number;
}

export interface StabilityTestResult {
  passed: boolean;
  driverReset: boolean;
  artifacting: boolean;
  crashes: number;
  thermalThrottle: boolean;
  powerThrottle: boolean;
  performanceRegression: boolean;
  errorMessages: string[];
  timestamp: number;
}

export interface Profile {
  id: string;
  name: string;
  description: string;
  configuration: TuningConfiguration;
  benchmarkResult?: BenchmarkResult;
  mode: OptimizationMode;
  isDefault: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OptimizationProgress {
  stage: OptimizationStage;
  currentStep: number;
  totalSteps: number;
  message: string;
  currentConfig?: TuningConfiguration;
  bestConfig?: TuningConfiguration;
  bestScore?: number;
}

export enum OptimizationStage {
  INITIALIZING = 'initializing',
  BASELINE = 'baseline',
  MEMORY_TUNING = 'memory_tuning',
  CORE_TUNING = 'core_tuning',
  POWER_TUNING = 'power_tuning',
  FAN_TUNING = 'fan_tuning',
  VALIDATION = 'validation',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ServiceConfig {
  telemetryInterval: number; // ms
  logRetention: number; // days
  autoStartOptimization: boolean;
  enableLogging: boolean;
  safetyChecks: {
    maxTemperature: number;
    maxPowerDraw: number;
    enableRollback: boolean;
    rollbackThreshold: number;
  };
}

export interface ServiceStatus {
  running: boolean;
  version: string;
  uptime: number; // seconds
  activeProfile?: string;
  optimizationInProgress: boolean;
  lastError?: string;
}

export interface TuningStep {
  parameter: 'memory' | 'core' | 'power' | 'fan';
  value: number;
  delta: number;
}

export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
}
