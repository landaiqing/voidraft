<template>
  <WindowsTitleBar v-if="systemStore.isWindows" />
  <MacOSTitleBar v-else-if="systemStore.isMacOS" />
  <LinuxTitleBar v-else />
</template>

<script setup lang="ts">
import { useSystemStore } from '@/stores/systemStore';
import WindowsTitleBar from './WindowsTitleBar.vue';
import MacOSTitleBar from './MacOSTitleBar.vue';
import LinuxTitleBar from './LinuxTitleBar.vue';

const systemStore = useSystemStore();
</script>

<style scoped lang="scss">
</style> 