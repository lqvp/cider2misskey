export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  at: number;
  context?: string;
  detail?: unknown;
}

export interface Logger {
  debug(message: string, detail?: unknown): void;
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
  setContext(context: string): void;
  setLevel(level: LogLevel): void;
}

export const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 25,
  error: 30,
};

export function shouldLog(configLevel: LogLevel, messageLevel: LogLevel): boolean {
  return LEVEL_WEIGHT[messageLevel] >= LEVEL_WEIGHT[configLevel];
}
