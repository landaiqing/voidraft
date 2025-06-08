import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useConfigStore } from '@/stores/configStore';

export function useSystemTheme() {
  const configStore = useConfigStore();
  const currentSystemTheme = ref<'dark' | 'light'>('dark');
  
  // 设置主题 - 简化版本
  const setTheme = (theme: string) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  };

  // 监听配置变化
  watch(
    () => configStore.config.appearance.systemTheme,
    (newTheme) => {
      // 直接根据配置设置主题，不需要检测系统主题
      const root = document.documentElement;
      root.setAttribute('data-theme', newTheme);
    },
    { immediate: true }
  );

  onMounted(() => {
    const root = document.documentElement;
    const systemTheme = configStore.config.appearance.systemTheme;
    root.setAttribute('data-theme', systemTheme);
  });

  return {
    currentSystemTheme,
    setTheme
  };
} 