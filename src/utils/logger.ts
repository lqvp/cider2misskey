import { useLogStore } from "../stores/logs";
import type { LogLevel, Logger } from "../types/logger";
import { shouldLog } from "../types/logger";
import type { NowPlayingConfig } from "../types";

export function createLogger(
  configGetter: () => NowPlayingConfig,
  context = "Plugin"
): Logger {
  const logStore = useLogStore();
  let currentContext = context;

  function logWithLevel(level: LogLevel, message: string, detail?: unknown) {
    const cfg = configGetter();
    if (!shouldLog(cfg.logLevel, level)) return;
    logStore.addLog(level, message, currentContext, detail);
  }

  return {
    debug: (msg, detail) => logWithLevel("debug", msg, detail),
    info: (msg, detail) => logWithLevel("info", msg, detail),
    warn: (msg, detail) => logWithLevel("warn", msg, detail),
    error: (msg, detail) => logWithLevel("error", msg, detail),
    setContext: (ctx) => {
      currentContext = ctx;
    },
    setLevel: () => {
      // レベル変更はconfig経由で行われる
    },
  };
}
