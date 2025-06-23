<script setup lang="ts">
import { onMounted } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useSystemStore } from '@/stores/systemStore';
import { useKeybindingStore } from '@/stores/keybindingStore';
import { useThemeStore } from '@/stores/themeStore';
import { useUpdateStore } from '@/stores/updateStore';
import WindowTitleBar from '@/components/titlebar/WindowTitleBar.vue';

const configStore = useConfigStore();
const systemStore = useSystemStore();
const keybindingStore = useKeybindingStore();
const themeStore = useThemeStore();
const updateStore = useUpdateStore();

// 应用启动时加载配置和初始化系统信息
onMounted(async () => {
  // 并行初始化配置、系统信息和快捷键配置
  await Promise.all([
    configStore.initConfig(),
    systemStore.initializeSystemInfo(),
    keybindingStore.loadKeyBindings(),
  ]);
  
  // 初始化语言和主题
  await configStore.initializeLanguage();
  themeStore.initializeTheme();
  
  // 启动时检查更新
  await updateStore.checkOnStartup();
});
</script>

<template>
  <div class="app-container">
    <WindowTitleBar />
    <div class="app-content">
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
