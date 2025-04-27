<script setup lang="ts">
import {onMounted} from 'vue';
import Editor from '@/editor/Editor.vue';
import Toolbar from '@/components/toolbar/Toolbar.vue';
import {useConfigStore} from "@/stores/configStore";

const configStore = useConfigStore();
onMounted(async () => {
  await configStore.loadConfigFromBackend();
})
</script>

<template>
  <div class="app-container">
    <div class="editor-wrapper">
      <Editor/>
    </div>
    <Toolbar/>
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

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
  }
}
</style>
