/**
 * Production Logger with file rotation and multiple transports
 */

import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

const LOG_DIR = process.env.AUTOOC_LOG_DIR || path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true});
}

// Custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
    const categoryStr = category ? `[${category}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(7)} ${categoryStr.padEnd(20)} ${message}${metaStr}`;
  })
);

// Create winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console transport (with colors)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    }),
    // File transport - all logs
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'autooc.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    // File transport - errors only
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'autooc-error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
  exitOnError: false,
});

/**
 * Production Logger class
 */
export class ProductionLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winstonLogger;
  }

  debug(category: string, message: string, meta?: any): void {
    this.logger.debug(message, { category, ...meta });
  }

  info(category: string, message: string, meta?: any): void {
    this.logger.info(message, { category, ...meta });
  }

  warn(category: string, message: string, meta?: any): void {
    this.logger.warn(message, { category, ...meta });
  }

  error(category: string, message: string, meta?: any): void {
    this.logger.error(message, { category, ...meta });
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logger.level = level;
    this.info('Logger', `Log level set to: ${level}`);
  }

  /**
   * Clean old log files
   */
  cleanOldLogs(retentionDays: number): void {
    const files = fs.readdirSync(LOG_DIR);
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        this.info('Logger', `Deleted old log file: ${file}`);
      }
    });
  }

  /**
   * Get log directory path
   */
  getLogDirectory(): string {
    return LOG_DIR;
  }

  /**
   * Flush logs (ensure all writes complete)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

// Export singleton instance
export const logger = new ProductionLogger();
