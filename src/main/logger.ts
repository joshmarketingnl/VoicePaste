import fs from 'fs';
import path from 'path';
import { Logger } from '../shared/logger';

const MAX_LOG_BYTES = 2 * 1024 * 1024;

function formatLine(level: string, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaText = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}] ${message}${metaText}`;
}

function rotateIfNeeded(logFile: string): void {
  try {
    if (!fs.existsSync(logFile)) {
      return;
    }
    const { size } = fs.statSync(logFile);
    if (size < MAX_LOG_BYTES) {
      return;
    }
    const backup = `${logFile}.1`;
    if (fs.existsSync(backup)) {
      fs.unlinkSync(backup);
    }
    fs.renameSync(logFile, backup);
  } catch {
    // Ignore rotation errors.
  }
}

export function createLogger(logDir: string, diagnostics: boolean): Logger {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, 'app.log');

  const write = (level: string, message: string, meta?: Record<string, unknown>) => {
    rotateIfNeeded(logFile);
    const line = formatLine(level, message, meta);
    fs.appendFileSync(logFile, `${line}\n`, { encoding: 'utf8' });
  };

  return {
    info: (message, meta) => write('INFO', message, meta),
    error: (message, meta) => write('ERROR', message, meta),
    debug: (message, meta) => {
      if (diagnostics) {
        write('DEBUG', message, meta);
      }
    },
  };
}
