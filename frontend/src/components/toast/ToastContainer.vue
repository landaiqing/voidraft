<template>
  <Teleport to="body">
    <TransitionGroup 
      v-for="position in positions" 
      :key="position"
      :class="['toast-container', `toast-container-${position}`]"
      name="toast-list"
      tag="div"
    >
      <ToastItem
        v-for="toast in getToastsByPosition(position)"
        :key="toast.id"
        :toast="toast"
        @close="removeToast"
      />
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import ToastItem from './Toast.vue';
import { useToastStore } from './toastStore';
import type { ToastPosition } from './types';

const toastStore = useToastStore();

const positions: ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const getToastsByPosition = (position: ToastPosition) => {
  return toastStore.toasts.filter(toast => toast.position === position);
};

const removeToast = (id: string) => {
  toastStore.remove(id);
};
</script>

<style scoped lang="scss">
.toast-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  
  > * {
    pointer-events: auto;
  }
}

// 顶部位置 - 增加间距避免覆盖标题栏
.toast-container-top-left {
  top: 35px;
  left: 20px;
  align-items: flex-start;
}

.toast-container-top-center {
  top: 35px;
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}

.toast-container-top-right {
  top: 35px;
  right: 20px;
  align-items: flex-end;
}

// 底部位置
.toast-container-bottom-left {
  bottom: 20px;
  left: 20px;
  align-items: flex-start;
  flex-direction: column-reverse;
}

.toast-container-bottom-center {
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
  flex-direction: column-reverse;
}

.toast-container-bottom-right {
  bottom: 20px;
  right: 20px;
  align-items: flex-end;
  flex-direction: column-reverse;
}

// TransitionGroup 列表动画 - 从哪来回哪去，收缩滑出
.toast-list-move {
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-list-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-list-leave-active {
  transition: all 0.3s cubic-bezier(0.6, 0, 0.8, 0.4);
  position: absolute !important;
}

// 右侧位置：从右滑入，收缩向右滑出
.toast-container-top-right,
.toast-container-bottom-right {
  .toast-list-enter-from {
    opacity: 0;
    transform: translateX(100%) scale(0.8);
  }
  
  .toast-list-leave-to {
    opacity: 0;
    transform: translateX(100%) scale(0.8);
  }
}

// 左侧位置：从左滑入，收缩向左滑出
.toast-container-top-left,
.toast-container-bottom-left {
  .toast-list-enter-from {
    opacity: 0;
    transform: translateX(-100%) scale(0.8);
  }
  
  .toast-list-leave-to {
    opacity: 0;
    transform: translateX(-100%) scale(0.8);
  }
}

// 居中位置：从上/下滑入，收缩向上/下滑出
.toast-container-top-center {
  .toast-list-enter-from {
    opacity: 0;
    transform: translateY(-100%) scale(0.8);
  }
  
  .toast-list-leave-to {
    opacity: 0;
    transform: translateY(-100%) scale(0.8);
  }
}

.toast-container-bottom-center {
  .toast-list-enter-from {
    opacity: 0;
    transform: translateY(100%) scale(0.8);
  }
  
  .toast-list-leave-to {
    opacity: 0;
    transform: translateY(100%) scale(0.8);
  }
}
</style>

