<script setup lang="ts">
import Editor from '@/editor/Editor.vue';
import Toolbar from '@/components/toolbar/Toolbar.vue';
</script>

<template>
  <div class="app-container">
    <div class="editor-wrapper">
      <Editor />
    </div>
    <Toolbar />
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
