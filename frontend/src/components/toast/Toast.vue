<template>
  <div 
    :class="['toast-item', `toast-${type}`]"
    @mouseenter="pauseTimer"
    @mouseleave="resumeTimer"
  >
    <!-- 图标 -->
    <div class="toast-icon">
      <svg v-if="type === 'success'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z" fill="currentColor"/>
      </svg>
      <svg v-else-if="type === 'error'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z" fill="currentColor"/>
      </svg>
      <svg v-else-if="type === 'warning'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M1 19h18L10 1 1 19zm10-3H9v-2h2v2zm0-4H9v-4h2v4z" fill="currentColor"/>
      </svg>
      <svg v-else-if="type === 'info'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9V9h2v6zm0-8H9V5h2v2z" fill="currentColor"/>
      </svg>
    </div>

    <!-- 内容 -->
    <div class="toast-content">
      <div v-if="title" class="toast-title">{{ title }}</div>
      <div class="toast-message">{{ message }}</div>
    </div>

    <!-- 关闭按钮 -->
    <button 
      v-if="closable"
      class="toast-close"
      @click="close"
      aria-label="Close"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { Toast } from './types';

const props = withDefaults(
  defineProps<{
    toast: Toast;
  }>(),
  {}
);

const emit = defineEmits<{
  close: [id: string];
}>();

const timer = ref<number | null>(null);
const remainingTime = ref(props.toast.duration);
const pausedAt = ref<number | null>(null);

const { id, message, title, type, duration, closable } = props.toast;

const close = () => {
  emit('close', id);
};

const startTimer = () => {
  if (duration > 0) {
    timer.value = window.setTimeout(() => {
      close();
    }, remainingTime.value);
  }
};

const clearTimer = () => {
  if (timer.value) {
    clearTimeout(timer.value);
    timer.value = null;
  }
};

const pauseTimer = () => {
  if (timer.value && duration > 0) {
    clearTimer();
    pausedAt.value = Date.now();
  }
};

const resumeTimer = () => {
  if (pausedAt.value && duration > 0) {
    const elapsed = Date.now() - pausedAt.value;
    remainingTime.value = Math.max(0, remainingTime.value - elapsed);
    pausedAt.value = null;
    startTimer();
  }
};

onMounted(() => {
  startTimer();
});

onUnmounted(() => {
  clearTimer();
});
</script>

<style scoped lang="scss">
.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 300px;
  max-width: 420px;
  padding: 16px 18px;
  margin-bottom: 12px;
  
  transform-origin: center center;
  
  // 毛玻璃效果
  // 亮色主题
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  
  cursor: default;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 6px 16px rgba(0, 0, 0, 0.1),
      0 2px 6px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
}

// 深色主题适配 - 使用应用的 data-theme 属性
:root[data-theme="dark"] .toast-item,
:root[data-theme="auto"] .toast-item {
  background: rgba(45, 45, 45, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  
  &:hover {
    box-shadow: 
      0 6px 16px rgba(0, 0, 0, 0.4),
      0 2px 6px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
}

// 跟随系统主题时的浅色偏好
@media (prefers-color-scheme: light) {
  :root[data-theme="auto"] .toast-item {
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.08),
      0 1px 3px rgba(0, 0, 0, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    
    &:hover {
      box-shadow: 
        0 6px 16px rgba(0, 0, 0, 0.1),
        0 2px 6px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }
  }
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  
  svg {
    width: 20px;
    height: 20px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  }
}

// 有标题时，图标与标题对齐（不需要 margin-top）
.toast-item:has(.toast-title) .toast-icon {
  margin-top: 0;
}

.toast-success .toast-icon {
  color: #16a34a;
}

.toast-error .toast-icon {
  color: #dc2626;
}

.toast-warning .toast-icon {
  color: #f59e0b;
}

.toast-info .toast-icon {
  color: #3b82f6;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--settings-text);
  margin-bottom: 4px;
  line-height: 1.4;
}

.toast-message {
  font-size: 12px;
  color: var(--settings-text-secondary);
  line-height: 1.5;
  word-wrap: break-word;
}

.toast-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  margin: 0;
  margin-top: 0px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 6px;
  color: var(--settings-text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  svg {
    width: 16px;
    height: 16px;
  }
  
  &:hover {
    background: rgba(0, 0, 0, 0.1);
    color: var(--settings-text);
    transform: rotate(90deg);
  }
  
  &:active {
    transform: rotate(90deg) scale(0.9);
  }
}

:root[data-theme="dark"] .toast-close,
:root[data-theme="auto"] .toast-close {
  background: rgba(255, 255, 255, 0.08);
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
}

@media (prefers-color-scheme: light) {
  :root[data-theme="auto"] .toast-close {
    background: rgba(0, 0, 0, 0.05);
    
    &:hover {
      background: rgba(0, 0, 0, 0.1);
    }
  }
}
</style>

