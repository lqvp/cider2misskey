import { defineStore } from "pinia";
import { ref } from "vue";

type LogLevel = "debug" | "info" | "error";

type LogEntry = {
  id: number;
  level: LogLevel;
  message: string;
  at: number;
  detail?: unknown;
};

export const useLogStore = defineStore("log-store", () => {
  const logs = ref<LogEntry[]>([]);
  let counter = 1;

  function log(level: LogLevel, message: string, detail?: unknown) {
    logs.value.unshift({
      id: counter++,
      level,
      message,
      at: Date.now(),
      detail,
    });
    // Keep only the latest 100 entries to avoid unbounded growth.
    if (logs.value.length > 100) {
      logs.value.splice(100);
    }
  }

  return { logs, log };
});
