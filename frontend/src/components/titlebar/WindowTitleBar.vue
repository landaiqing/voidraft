<template>
  <WindowsTitleBar v-if="isWindows" />
  <MacOSTitleBar v-else-if="isMacOS" />
  <LinuxTitleBar v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as runtime from '@wailsio/runtime';
import WindowsTitleBar from './WindowsTitleBar.vue';
import MacOSTitleBar from './MacOSTitleBar.vue';
import LinuxTitleBar from './LinuxTitleBar.vue';

// 操作系统检测
const isWindows = ref(false);
const isMacOS = ref(false);

onMounted(async () => {
  try {
    isWindows.value = runtime.System.IsWindows();
    isMacOS.value = runtime.System.IsMac();
  } catch (error) {
    // 默认使用 Windows 风格
    isWindows.value = true;
  }
});
</script>

<style scoped lang="scss">
</style> 