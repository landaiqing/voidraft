<script setup lang="ts">
import { onMounted } from 'vue';
import { useConfigStore } from '@/stores/configStore';

const configStore = useConfigStore();


// 应用启动时加载配置
onMounted(async () => {
  await configStore.initializeLanguage();
  await configStore.initConfig();
});
</script>

<template>
  <div class="app-container">
    <router-view/>
  </div>
</template>

<style scoped lang="scss">
.app-container {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
}
</style>
