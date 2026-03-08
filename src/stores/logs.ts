import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { LogLevel, LogEntry } from "../types/logger";

export const useLogStore = defineStore("log-store", () => {
  const logs = ref<LogEntry[]>([]);
  const maxLogs = 100;
  let counter = 1;
  
  // フィルタリング用のcomputed
  const debugLogs = computed(() => logs.value.filter((l) => l.level === "debug"));
  const infoLogs = computed(() => logs.value.filter((l) => l.level === "info"));
  const warnLogs = computed(() => logs.value.filter((l) => l.level === "warn"));
  const errorLogs = computed(() => logs.value.filter((l) => l.level === "error"));
  
  function addLog(
    level: LogLevel,
    message: string,
    context?: string,
    detail?: unknown
  ) {
    logs.value.unshift({
      id: counter++,
      level,
      message,
      at: Date.now(),
      context,
      detail,
    });
    if (logs.value.length > maxLogs) {
      logs.value.splice(maxLogs);
    }
  }

  function log(level: LogLevel, message: string, detail?: unknown) {
    addLog(level, message, undefined, detail);
  }

  function clear() {
    logs.value = [];
  }

  function exportLogs(): string {
    return JSON.stringify(logs.value, null, 2);
  }

  return {
    logs,
    debugLogs,
    infoLogs,
    warnLogs,
    errorLogs,
    log,
    addLog,
    clear,
    exportLogs,
  };
});
