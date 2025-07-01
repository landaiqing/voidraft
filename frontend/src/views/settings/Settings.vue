<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import MemoryMonitor from '@/components/monitor/MemoryMonitor.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

// 接收路由传入的参数
const props = defineProps<{
  returnDocumentId?: number | null
}>();

// 导航配置
const navItems = [
  { id: 'general', icon: '⚙️', route: '/settings/general' },
  { id: 'editing', icon: '✏️', route: '/settings/editing' },
  { id: 'appearance', icon: '🎨', route: '/settings/appearance' },
  { id: 'extensions', icon: '🧩', route: '/settings/extensions' },
  { id: 'keyBindings', icon: '⌨️', route: '/settings/key-bindings' },
  { id: 'updates', icon: '🔄', route: '/settings/updates' }
];

const activeNavItem = ref(route.path.split('/').pop() || 'general');

// 处理导航点击
const handleNavClick = (item: typeof navItems[0]) => {
  activeNavItem.value = item.id;
  router.push(item.route);
};

// 返回编辑器
const goBackToEditor = async () => {
  // 如果有返回文档ID，则传递参数
  if (props.returnDocumentId) {
    await router.push({
      path: '/',
      query: { documentId: props.returnDocumentId }
    });
  } else {
    await router.push('/');
  }
};

</script>

<template>
  <div class="settings-container">
    <div class="settings-sidebar">
      <div class="settings-header">
        <div class="header-content">
          <button class="back-button" @click="goBackToEditor" :title="t('settings.backToEditor')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>{{ t('settings.title') }}</h1>
        </div>
      </div>
      <div class="settings-nav thin-scrollbar">
        <div
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: activeNavItem === item.id }"
          @click="handleNavClick(item)"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-text">{{ t(`settings.${item.id}`) }}</span>
        </div>
      </div>
      <div class="settings-footer">
        <div class="memory-info-section">
          <div class="section-title">{{ t('settings.systemInfo') }}</div>
          <MemoryMonitor />
        </div>
      </div>
    </div>
    <div class="settings-content">
      <router-view />
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-container {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: var(--settings-bg);
  color: var(--settings-text);
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  .settings-sidebar {
    width: 180px;
    height: 100%;
    background-color: var(--settings-card-bg);
    border-right: 1px solid var(--settings-border);
    display: flex;
    flex-direction: column;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
    
    .settings-header {
      padding: 16px 14px;
      border-bottom: 1px solid var(--settings-border);
      background-color: var(--settings-card-bg);
      
      .header-content {
        display: flex;
        align-items: center;
        gap: 12px;
        
        .back-button {
          background: none;
          border: none;
          color: var(--settings-text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          
          &:hover {
            color: var(--settings-text);
            background-color: var(--settings-hover);
          }
          
          svg {
            width: 18px;
            height: 18px;
          }
        }
        
        h1 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: var(--settings-text);
        }
      }
    }
    
    .settings-nav {
      flex: 1;
      padding: 10px 0;
      overflow-y: auto;
      
              .nav-item {
        display: flex;
        align-items: center;
        padding: 10px 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-left: 3px solid transparent;
        
        &:hover {
          background-color: var(--settings-hover);
        }
        
        &.active {
          background-color: var(--settings-hover);
          border-left-color: #4a9eff;
          font-weight: 500;
        }
        
        .nav-icon {
          margin-right: 8px;
          font-size: 14px;
          opacity: 0.9;
        }
        
        .nav-text {
          font-size: 13px;
        }
      }
    }
    
    .settings-footer {
      padding: 10px 14px 14px 14px;
      border-top: 1px solid var(--settings-border);
      background-color: var(--settings-card-bg);
      
      .memory-info-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        
        .section-title {
          font-size: 9px;
          color: var(--settings-text-secondary);
          font-weight: 500;
          margin-bottom: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      }
    }
  }

  .settings-content {
    flex: 1;
    height: 100%;
    padding: 20px;
    overflow-y: auto;
    background-color: var(--settings-bg);
  }
}


</style> 