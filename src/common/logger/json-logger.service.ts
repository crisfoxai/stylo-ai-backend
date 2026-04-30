import { LoggerService, LogLevel } from '@nestjs/common';

export class JsonLogger implements LoggerService {
  private readonly levelPriority: Record<LogLevel, number> = {
    verbose: 0,
    debug: 1,
    log: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  };

  private minLevel: number;

  constructor(minLevel: LogLevel = 'log') {
    this.minLevel = this.levelPriority[minLevel] ?? 2;
  }

  private write(level: string, message: unknown, context?: string): void {
    if ((this.levelPriority[level as LogLevel] ?? 0) < this.minLevel) return;

    const entry: Record<string, unknown> = {
      level,
      ts: new Date().toISOString(),
    };
    if (context) entry['context'] = context;

    if (typeof message === 'string') {
      entry['msg'] = message;
    } else if (message instanceof Error) {
      entry['msg'] = message.message;
      entry['stack'] = message.stack;
    } else {
      entry['msg'] = message;
    }

    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    const entry: Record<string, unknown> = {
      level: 'error',
      ts: new Date().toISOString(),
    };
    if (context) entry['context'] = context;
    if (typeof message === 'string') entry['msg'] = message;
    else if (message instanceof Error) {
      entry['msg'] = message.message;
      entry['stack'] = message.stack;
    } else {
      entry['msg'] = message;
    }
    if (trace) entry['stack'] = trace;
    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
}
