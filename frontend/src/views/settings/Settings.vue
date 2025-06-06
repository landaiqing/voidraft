<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useI18n } from 'vue-i18n';
import { ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import MemoryMonitor from '@/components/monitor/MemoryMonitor.vue';

const { t } = useI18n();
const configStore = useConfigStore();
const router = useRouter();
const route = useRoute();

// 导航配置
const navItems = [
  { id: 'general', icon: '⚙️', route: '/settings/general' },
  { id: 'editing', icon: '✏️', route: '/settings/editing' },
  { id: 'appearance', icon: '🎨', route: '/settings/appearance' },
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
const goBackToEditor = () => {
  router.push('/');
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
      <div class="settings-nav">
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
  height: 100vh;
  margin: 0;
  padding: 0;
  background-color: #2a2a2a;
  color: #e0e0e0;
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  .settings-sidebar {
    width: 200px;
    height: 100%;
    background-color: #333333;
    border-right: 1px solid #444444;
    display: flex;
    flex-direction: column;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
    
    .settings-header {
      padding: 20px 16px;
      border-bottom: 1px solid #444444;
      background-color: #2d2d2d;
      
      .header-content {
        display: flex;
        align-items: center;
        gap: 12px;
        
        .back-button {
          background: none;
          border: none;
          color: #a0a0a0;
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          
          &:hover {
            color: #e0e0e0;
            background-color: #3a3a3a;
          }
          
          svg {
            width: 18px;
            height: 18px;
          }
        }
        
        h1 {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          color: #ffffff;
        }
      }
    }
    
    .settings-nav {
      flex: 1;
      padding: 10px 0;
      overflow-y: auto;
      
      &::-webkit-scrollbar {
        width: 8px;
      }
      
      &::-webkit-scrollbar-track {
        background: #333333;
      }
      
      &::-webkit-scrollbar-thumb {
        background-color: #555555;
        border-radius: 4px;
      }
      
      .nav-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-left: 3px solid transparent;
        
        &:hover {
          background-color: #3a3a3a;
        }
        
        &.active {
          background-color: #3c3c3c;
          border-left-color: #4a9eff;
          font-weight: 500;
        }
        
        .nav-icon {
          margin-right: 10px;
          font-size: 16px;
          opacity: 0.9;
        }
        
        .nav-text {
          font-size: 14px;
        }
      }
    }
    
    .settings-footer {
      padding: 12px 16px 16px 16px;
      border-top: 1px solid #444444;
      background-color: #2d2d2d;
      
      .memory-info-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        
        .section-title {
          font-size: 10px;
          color: #777777;
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
    padding: 24px;
    overflow-y: auto;
    background-color: #2a2a2a;
    
    &::-webkit-scrollbar {
      width: 10px;
    }
    
    &::-webkit-scrollbar-track {
      background: #2a2a2a;
    }
    
    &::-webkit-scrollbar-thumb {
      background-color: #555555;
      border-radius: 5px;
      border: 2px solid #2a2a2a;
    }
  }
}

// 自定义变量
:root {
  --border-color: #444444;
  --hover-color: #3a3a3a;
  --active-bg: #3c3c3c;
  --accent-color: #4a9eff;
  --bg-primary: #2a2a2a;
  --bg-secondary: #333333;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-muted: #777777;
}
</style> 