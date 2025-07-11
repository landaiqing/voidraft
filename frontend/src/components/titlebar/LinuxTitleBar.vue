<template>
  <div class="linux-titlebar" style="--wails-draggable:drag" @contextmenu.prevent>
    <div class="titlebar-content" @dblclick="toggleMaximize" @contextmenu.prevent>
      <div class="titlebar-icon">
        <img src="/appicon.png" alt="voidraft" />
      </div>
      <div class="titlebar-title">{{ titleText }}</div>
    </div>
    
    <div class="titlebar-controls" style="--wails-draggable:no-drag" @contextmenu.prevent>
      <button 
        class="titlebar-button minimize-button" 
        @click="minimizeWindow"
        :title="t('titlebar.minimize')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M4 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      
      <button 
        class="titlebar-button maximize-button" 
        @click="toggleMaximize"
        :title="isMaximized ? t('titlebar.restore') : t('titlebar.maximize')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" v-if="!isMaximized">
          <rect x="4" y="4" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <svg width="16" height="16" viewBox="0 0 16 16" v-else>
          <rect x="3" y="5" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <rect x="7" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
      
      <button 
        class="titlebar-button close-button" 
        @click="closeWindow"
        :title="t('titlebar.close')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M4 4l8 8m0-8L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import * as runtime from '@wailsio/runtime';
import { useWindowStore } from '@/stores/windowStore';
import { useDocumentStore } from '@/stores/documentStore';

const { t } = useI18n();
const isMaximized = ref(false);
const documentStore = useDocumentStore();

const minimizeWindow = async () => {
  try {
    await runtime.Window.Minimise();
  } catch (error) {
    // Error handling
  }
};

const toggleMaximize = async () => {
  try {
    const newState = !isMaximized.value;
    isMaximized.value = newState;
    
    if (newState) {
      await runtime.Window.Maximise();
    } else {
      await runtime.Window.UnMaximise();
    }
    
    setTimeout(async () => {
      await checkMaximizedState();
    }, 100);
  } catch (error) {
    isMaximized.value = !isMaximized.value;
  }
};

const closeWindow = async () => {
  try {
    await runtime.Window.Close();
  } catch (error) {
    // Error handling
  }
};

const checkMaximizedState = async () => {
  try {
    isMaximized.value = await runtime.Window.IsMaximised();
  } catch (error) {
    // Error handling
  }
};

// 计算标题文本
const titleText = computed(() => {
  const currentDoc = documentStore.currentDocument;
  return currentDoc ? `voidraft - ${currentDoc.title}` : 'voidraft';
});

onMounted(async () => {
  await checkMaximizedState();
  
  runtime.Events.On('window:maximised', () => {
    isMaximized.value = true;
  });
  
  runtime.Events.On('window:unmaximised', () => {
    isMaximized.value = false;
  });

  runtime.Events.On('window:focus', async () => {
    await checkMaximizedState();
  });

});
onUnmounted(() => {
  runtime.Events.Off('window:maximised');
  runtime.Events.Off('window:unmaximised');
  runtime.Events.Off('window:focus');
});
</script>

<style scoped lang="scss">
.linux-titlebar {
  display: flex;
  height: 34px;
  background: var(--toolbar-bg, linear-gradient(to bottom, #f6f6f6, #e8e8e8));
  border-bottom: 1px solid var(--toolbar-border, #d0d0d0);
  user-select: none;
  -webkit-user-select: none;
  width: 100%;
  font-family: 'Ubuntu', 'Cantarell', 'DejaVu Sans', system-ui, sans-serif;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-content {
  display: flex;
  align-items: center;
  flex: 1;
  padding-left: 12px;
  gap: 8px;
  color: var(--toolbar-text, #333);
  font-size: 13px;
  font-weight: 500;
  cursor: default;
  
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-content .titlebar-icon {
  width: 16px;
  height: 16px;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.titlebar-title {
  font-size: 13px;
  color: var(--toolbar-text, #333);
  font-weight: 500;
}

.titlebar-controls {
  display: flex;
  height: 100%;
  
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-button {
  width: 36px;
  height: 34px;
  border: none;
  background: transparent;
  color: var(--toolbar-text, #555);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
  margin: 0;
  border-radius: 0;
  
  svg {
    width: 16px;
    height: 16px;
    opacity: 0.8;
    transition: opacity 0.15s ease;
  }
  
  &:hover {
    background: var(--toolbar-button-hover, rgba(0, 0, 0, 0.1));
    
    svg {
      opacity: 1;
    }
  }
  
  &:active {
    background: var(--toolbar-button-active, rgba(0, 0, 0, 0.15));
  }
}

.close-button {
  &:hover {
    background: #e74c3c;
    color: #ffffff;
    
    svg {
      opacity: 1;
    }
  }
  
  &:active {
    background: #c0392b;
  }
}

// Dark theme support
@media (prefers-color-scheme: dark) {
  .linux-titlebar {
    background: var(--toolbar-bg, linear-gradient(to bottom, #3c3c3c, #2e2e2e));
    border-bottom-color: var(--toolbar-border, #1e1e1e);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .titlebar-content,
  .titlebar-title {
    color: var(--toolbar-text, #f0f0f0);
  }
  
  .titlebar-button {
    color: var(--toolbar-text, #ccc);
    
    &:hover {
      background: var(--toolbar-button-hover, rgba(255, 255, 255, 0.1));
    }
    
    &:active {
      background: var(--toolbar-button-active, rgba(255, 255, 255, 0.15));
    }
  }
}

// GNOME-like styling variant
.linux-titlebar.gnome-style {
  height: 38px;
  border-radius: 12px 12px 0 0;
  
  .titlebar-button {
    height: 38px;
    width: 32px;
    border-radius: 6px;
    margin: 3px 2px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
}

// KDE-like styling variant
.linux-titlebar.kde-style {
  background: var(--toolbar-bg, #eff0f1);
  border-bottom: 1px solid var(--toolbar-border, #bdc3c7);
  
  .titlebar-button {
    border-radius: 4px;
    margin: 2px 1px;
    
    &:hover {
      background: rgba(61, 174, 233, 0.2);
    }
  }
}
</style>