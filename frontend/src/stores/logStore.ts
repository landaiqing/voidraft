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
}

export const useLogStore = defineStore('log', () => {
  // 日志列表
  const logs = ref<LogItem[]>([]);
  
  // 最近一条日志，用于在工具栏显示
  const latestLog = ref<LogItem | null>(null);
  
  // 是否显示日志
  const showLog = ref(true);
  
  // 自动隐藏计时器
  let hideTimer: number | null = null;
  
  // 添加日志
  function addLog(level: LogLevel, message: string, autoHideDelay = 5000) {
    const id = Date.now();
    const logItem: LogItem = {
      id,
      level,
      message,
      timestamp: new Date()
    };
    
    // 添加到日志列表
    logs.value.push(logItem);
    
    // 保持日志列表在合理大小
    if (logs.value.length > 100) {
      logs.value = logs.value.slice(-100);
    }
    
    // 设置最新日志
    latestLog.value = logItem;
    showLog.value = true;
    
    // 设置自动隐藏
    if (hideTimer) {
      window.clearTimeout(hideTimer);
    }
    
    if (autoHideDelay > 0) {
      hideTimer = window.setTimeout(() => {
        showLog.value = false;
      }, autoHideDelay);
    }
    
    return id;
  }
  
  // 添加不同级别的日志的便捷方法
  function info(message: string, autoHideDelay = 5000) {
    return addLog(LogLevel.INFO, message, autoHideDelay);
  }
  
  function warning(message: string, autoHideDelay = 5000) {
    return addLog(LogLevel.WARNING, message, autoHideDelay);
  }
  
  function error(message: string, autoHideDelay = 5000) {
    return addLog(LogLevel.ERROR, message, autoHideDelay);
  }
  
  // 清除日志
  function clearLogs() {
    logs.value = [];
    latestLog.value = null;
    showLog.value = false;
  }
  
  // 手动隐藏当前日志
  function hideCurrentLog() {
    showLog.value = false;
  }
  
  return {
    // 状态
    logs,
    latestLog,
    showLog,
    
    // 方法
    addLog,
    info,
    warning,
    error,
    clearLogs,
    hideCurrentLog
  };
}); 