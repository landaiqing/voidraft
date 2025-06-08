<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useSystemTheme } from '@/composables/useSystemTheme';
import WindowTitleBar from '@/components/titlebar/WindowTitleBar.vue';
import * as runtime from '@wailsio/runtime';

const configStore = useConfigStore();
const { setTheme } = useSystemTheme();

// 操作系统检测
const isWindows = ref(false);
const isMacOS = ref(false);

// 根据操作系统计算标题栏高度
const titleBarHeight = computed(() => {
  if (isWindows.value) return '32px';
  if (isMacOS.value) return '28px';
  return '34px'; // Linux 默认
});

// 应用启动时加载配置和检测操作系统
onMounted(async () => {
  await configStore.initConfig();
  await configStore.initializeLanguage();
  setTheme(configStore.config.appearance.systemTheme);
  
  // 检测操作系统
  try {
    isWindows.value = runtime.System.IsWindows();
    isMacOS.value = runtime.System.IsMac();
  } catch (error) {
    console.error('检测操作系统失败:', error);
    // 默认使用 Windows
    isWindows.value = true;
  }
});
</script>

<template>
  <div class="app-container">
    <WindowTitleBar />
    <div class="app-content" :style="{ marginTop: titleBarHeight }">
      <router-view/>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-container {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
