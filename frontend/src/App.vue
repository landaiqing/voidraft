<script setup lang="ts">
import {onBeforeMount} from 'vue';
import {useConfigStore} from '@/stores/configStore';
import {useSystemStore} from '@/stores/systemStore';
import {useKeybindingStore} from '@/stores/keybindingStore';
import {useThemeStore} from '@/stores/themeStore';
import {useUpdateStore} from '@/stores/updateStore';
import WindowTitleBar from '@/components/titlebar/WindowTitleBar.vue';
import {useTranslationStore} from "@/stores/translationStore";
import {useI18n} from "vue-i18n";
import {LanguageType} from "../bindings/voidraft/internal/models";

const configStore = useConfigStore();
const systemStore = useSystemStore();
const keybindingStore = useKeybindingStore();
const themeStore = useThemeStore();
const updateStore = useUpdateStore();
const translationStore = useTranslationStore();
const {locale} = useI18n();

onBeforeMount(async () => {
  // 并行初始化配置、系统信息和快捷键配置
  await Promise.all([
    configStore.initConfig(),
    systemStore.initSystemInfo(),
    keybindingStore.loadKeyBindings(),
  ]);

  locale.value = configStore.config.appearance.language || LanguageType.LangEnUS;
  await themeStore.initTheme();
  await translationStore.loadTranslators();

  // 启动时检查更新
  await updateStore.checkOnStartup();
});
</script>

<template>
  <div class="app-container">
    <WindowTitleBar/>
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
