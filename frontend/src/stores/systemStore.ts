import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as runtime from '@wailsio/runtime';

export interface SystemEnvironment {
  OS: string;
  Arch: string;
  Debug: boolean;
  OSInfo: {
    Name: string;
    Branding: string;
    Version: string;
    ID: string;
  };
  PlatformInfo?: Record<string, string>;
}

export const useSystemStore = defineStore('system', () => {
  // 状态
  const environment = ref<SystemEnvironment | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const isWindows = computed(() => environment.value?.OS === 'windows');
  const isMacOS = computed(() => environment.value?.OS === 'darwin');
  const isLinux = computed(() => environment.value?.OS === 'linux');
  
  // 获取操作系统名称
  const osName = computed(() => {
    if (!environment.value) return 'Unknown';
    return environment.value.OSInfo?.Name || environment.value.OS || 'Unknown';
  });

  // 获取架构信息
  const architecture = computed(() => environment.value?.Arch || 'Unknown');

  // 获取标题栏高度
  const titleBarHeight = computed(() => {
    if (isWindows.value) return '32px';
    if (isMacOS.value) return '28px';
    return '34px'; // Linux 默认
  });

  // 初始化系统信息
  const initializeSystemInfo = async (): Promise<void> => {
    if (isLoading.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const env = await runtime.System.Environment();
      environment.value = env;
    } catch (err) {
      error.value = 'Failed to get system environment';
      environment.value = null;
    } finally {
      isLoading.value = false;
    }
  };

  // 获取平台特定信息
  const getPlatformInfo = () => {
    return environment.value?.PlatformInfo || {};
  };

  // 检查是否支持某项功能（基于操作系统）
  const supportsFeature = (feature: string): boolean => {
    switch (feature) {
      case 'systemTray':
        return true; // 所有平台都支持
      case 'globalHotkeys':
        return !isLinux.value; // Linux 支持可能有限
      case 'transparency':
        return isWindows.value || isMacOS.value;
      default:
        return false;
    }
  };

  return {
    // 状态
    environment,
    isLoading,
    error,

    // 计算属性
    isWindows,
    isMacOS,
    isLinux,
    osName,
    architecture,
    titleBarHeight,

    // 方法
    initializeSystemInfo,
    getPlatformInfo,
    supportsFeature
  };
}); 