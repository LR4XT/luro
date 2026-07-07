import { useCallback, useState } from 'react';

export type ConsoleLogLevel = 'info' | 'success' | 'warn' | 'error';

export interface ConsoleLogEntry {
  id: string;
  time: Date;
  level: ConsoleLogLevel;
  action: string;
  message: string;
}

const MAX_LOGS = 120;

function createLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useConsoleLog() {
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);

  const appendLog = useCallback(
    (entry: { level: ConsoleLogLevel; action: string; message: string }) => {
      setLogs((prev) =>
        [
          {
            id: createLogId(),
            time: new Date(),
            ...entry,
          },
          ...prev,
        ].slice(0, MAX_LOGS),
      );
    },
    [],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, appendLog, clearLogs };
}

export function formatLogTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
