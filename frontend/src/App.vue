<script setup lang="ts">
import {onMounted} from 'vue';
import {useConfigStore} from "@/stores/configStore";

const configStore = useConfigStore();

onMounted(async () => {
  await configStore.loadConfigFromBackend();
})
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
