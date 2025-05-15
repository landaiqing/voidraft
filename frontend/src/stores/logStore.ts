import { defineStore } from 'pinia';
import { ref } from 'vue';

// 日志级别定义
export enum LogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

// 日志项结构
export interface LogItem {
  id: number;
  level: LogLevel;
  message: string;
  timestamp: Date;
  shown: boolean; // 是否已显示过
}

export const useLogStore = defineStore('log', () => {
  // 日志列表
  const logs = ref<LogItem[]>([]);
  
  // 显示队列 - 存储待显示的日志
  const displayQueue = ref<LogItem[]>([]);
  
  // 当前显示的日志
  const currentLog = ref<LogItem | null>(null);
  
  // 最近一条日志，用于在工具栏显示
  const latestLog = ref<LogItem | null>(null);
  
  // 是否显示日志
  const showLog = ref(false);
  
  // 自动隐藏计时器
  let hideTimer: number | null = null;

  // 根据日志级别获取显示时间
  function getDisplayTimeByLevel(level: LogLevel): number {
    switch(level) {
      case LogLevel.ERROR:
        return 8000; // 错误显示更长时间
      case LogLevel.WARNING:
        return 6000; // 警告显示中等时间
      case LogLevel.INFO:
      default:
        return 4000; // 信息显示较短时间
    }
  }
  
  // 显示下一条日志
  function showNextLog() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }

    // 如果队列为空，则不显示
    if (displayQueue.value.length === 0) {
      showLog.value = false;
      currentLog.value = null;
      return;
    }

    // 取出队列中第一条日志显示
    const nextLog = displayQueue.value.shift()!;
    currentLog.value = nextLog;
    showLog.value = true;

    // 设置自动隐藏和切换到下一条
    const displayTime = getDisplayTimeByLevel(nextLog.level);
    hideTimer = window.setTimeout(() => {
      showNextLog();
    }, displayTime);
  }
  
  // 添加日志
  function addLog(level: LogLevel, message: string, autoHideDelay = 0) {
    const id = Date.now();
    const logItem: LogItem = {
      id,
      level,
      message,
      timestamp: new Date(),
      shown: false
    };
    
    // 添加到日志列表
    logs.value.push(logItem);
    
    // 保持日志列表在合理大小
    if (logs.value.length > 100) {
      logs.value = logs.value.slice(-100);
    }
    
    // 设置最新日志
    latestLog.value = logItem;
    
    // 添加到显示队列
    displayQueue.value.push(logItem);
    
    // 如果当前没有显示日志，则开始显示
    if (!currentLog.value && !hideTimer) {
      showNextLog();
    }
    
    return id;
  }
  
  // 添加不同级别的日志的便捷方法
  function info(message: string) {
    return addLog(LogLevel.INFO, message);
  }
  
  function warning(message: string) {
    return addLog(LogLevel.WARNING, message);
  }
  
  function error(message: string) {
    return addLog(LogLevel.ERROR, message);
  }
  
  // 清除日志
  function clearLogs() {
    logs.value = [];
    displayQueue.value = [];
    latestLog.value = null;
    currentLog.value = null;
    showLog.value = false;
    
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }
  
  // 手动隐藏当前日志
  function hideCurrentLog() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    showLog.value = false;
    currentLog.value = null;
    displayQueue.value = []; // 清空队列
  }
  
  return {
    // 状态
    logs,
    latestLog,
    currentLog,
    showLog,
    displayQueue,
    
    // 方法
    addLog,
    info,
    warning,
    error,
    clearLogs,
    hideCurrentLog,
    showNextLog
  };
}); 