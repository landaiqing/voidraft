<script setup lang="ts">
import { onMounted } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useSystemStore } from '@/stores/systemStore';
import WindowTitleBar from '@/components/titlebar/WindowTitleBar.vue';

const configStore = useConfigStore();
const systemStore = useSystemStore();

// 应用启动时加载配置和初始化系统信息
onMounted(async () => {
  // 并行初始化配置和系统信息
  await Promise.all([
    configStore.initConfig(),
    systemStore.initializeSystemInfo(),
  ]);
  
  await configStore.initializeLanguage();
});
</script>

<template>
  <div class="app-container">
    <WindowTitleBar />
    <div class="app-content" :style="{ marginTop: systemStore.titleBarHeight }">
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
