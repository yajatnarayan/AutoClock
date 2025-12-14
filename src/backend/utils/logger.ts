/**
 * Logging utility for AutoOC backend service
 */

import * as fs from 'fs';
import * as path from 'path';
import { LogEntry } from '../types';

export class Logger {
  private logDir: string;
  private logFile: string;
  private enableConsole: boolean;
  private enableFile: boolean;

  constructor(logDir: string = './logs', enableConsole: boolean = true, enableFile: boolean = true) {
    this.logDir = logDir;
    this.logFile = path.join(logDir, `autooc-${this.getDateString()}.log`);
    this.enableConsole = enableConsole;
    this.enableFile = enableFile;

    if (this.enableFile) {
      this.ensureLogDirectory();
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const category = entry.category.padEnd(15);
    let message = `[${timestamp}] ${level} [${category}] ${entry.message}`;

    if (entry.data) {
      message += `\n${JSON.stringify(entry.data, null, 2)}`;
    }

    return message;
  }

  private write(entry: LogEntry): void {
    const message = this.formatMessage(entry);

    if (this.enableConsole) {
      const colorCode = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
      }[entry.level];
      console.log(`${colorCode}%s\x1b[0m`, message);
    }

    if (this.enableFile) {
      fs.appendFileSync(this.logFile, message + '\n');
    }
  }

  debug(category: string, message: string, data?: any): void {
    this.write({
      timestamp: Date.now(),
      level: 'debug',
      category,
      message,
      data,
    });
  }

  info(category: string, message: string, data?: any): void {
    this.write({
      timestamp: Date.now(),
      level: 'info',
      category,
      message,
      data,
    });
  }

  warn(category: string, message: string, data?: any): void {
    this.write({
      timestamp: Date.now(),
      level: 'warn',
      category,
      message,
      data,
    });
  }

  error(category: string, message: string, data?: any): void {
    this.write({
      timestamp: Date.now(),
      level: 'error',
      category,
      message,
      data,
    });
  }

  cleanOldLogs(retentionDays: number): void {
    if (!this.enableFile) return;

    const files = fs.readdirSync(this.logDir);
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    files.forEach(file => {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        this.info('Logger', `Deleted old log file: ${file}`);
      }
    });
  }
}

export const logger = new Logger();
