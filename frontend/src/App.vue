<script setup lang="ts">
import { onMounted } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import WindowTitleBar from '@/components/titlebar/WindowTitleBar.vue';

const configStore = useConfigStore();


// 应用启动时加载配置
onMounted(async () => {
  await configStore.initConfig();
  await configStore.initializeLanguage();
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
  margin-top: 32px;
  overflow: hidden;
  position: relative;
}
</style>
