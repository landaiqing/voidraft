<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { markdownPreviewManager } from './manager';
import { createMarkdownRenderer } from './renderer';
import { updateMermaidTheme } from '@/common/markdown-it/plugins/markdown-it-mermaid';
import { useThemeStore } from '@/stores/themeStore';
import { createDebounce } from '@/common/utils/debounce';
import { morphHTML } from '@/common/utils/domDiff';
import * as runtime from '@wailsio/runtime';

import './github-markdown.css';

const state = markdownPreviewManager.useState();
const themeStore = useThemeStore();

const panelRef = ref<HTMLDivElement | null>(null);
const contentRef = ref<HTMLDivElement | null>(null);
const resizeHandleRef = ref<HTMLDivElement | null>(null);

const isVisible = computed(() => state.value.visible);
const content = computed(() => state.value.content);
const height = computed(() => state.value.position.height);

// Markdown 渲染器
let md = createMarkdownRenderer();

// 渲染的 HTML
const renderedHtml = ref('');
let lastRenderedContent = '';
let isDestroyed = false;

/**
 * 使用 DOM Diff 渲染内容
 */
function renderWithDiff(markdownContent: string): void {
  if (isDestroyed || !contentRef.value) return;

  try {
    const newHtml = md.render(markdownContent);
    
    // 首次渲染或内容为空，直接设置
    if (!lastRenderedContent || contentRef.value.children.length === 0) {
      renderedHtml.value = newHtml;
    } else {
      // 使用 DOM Diff 增量更新
      morphHTML(contentRef.value, newHtml);
    }
    
    lastRenderedContent = markdownContent;
  } catch (error) {
    console.warn('Markdown render error:', error);
    renderedHtml.value = `<div class="markdown-error">Render failed: ${error}</div>`;
  }
}

/**
 * 异步渲染大内容
 */
function renderLargeContentAsync(markdownContent: string): void {
  if (isDestroyed || !isVisible.value) return;

  // 首次渲染显示加载状态
  if (!lastRenderedContent) {
    renderedHtml.value = '<div class="markdown-loading">Rendering...</div>';
  }
  
  // 使用 requestIdleCallback 在浏览器空闲时渲染
  const callback = window.requestIdleCallback || ((cb: IdleRequestCallback) => setTimeout(cb, 1));
  
  callback(() => {
    // 再次检查状态，防止异步回调时预览已关闭
    if (isDestroyed || !isVisible.value || !contentRef.value) return;

    try {
      const newHtml = md.render(markdownContent);
      
      // 首次渲染或内容为空
      if (!lastRenderedContent || contentRef.value.children.length === 0) {
        // 使用 DocumentFragment 减少 DOM 操作
        const fragment = document.createRange().createContextualFragment(newHtml);
        if (contentRef.value) {
          contentRef.value.innerHTML = '';
          contentRef.value.appendChild(fragment);
        }
      } else {
        // 使用 DOM Diff 增量更新
        morphHTML(contentRef.value, newHtml);
      }
      
      lastRenderedContent = markdownContent;
    } catch (error) {
      console.warn('Large content render error:', error);
      if (isVisible.value) {
        renderedHtml.value = `<div class="markdown-error">Render failed: ${error}</div>`;
      }
    }
  });
}

/**
 * 渲染 Markdown 内容
 */
function renderMarkdown(markdownContent: string): void {
  if (!markdownContent || markdownContent === lastRenderedContent) {
    return;
  }

  // 大内容使用异步渲染
  if (markdownContent.length > 1000) {
    renderLargeContentAsync(markdownContent);
  } else {
    renderWithDiff(markdownContent);
  }
}

/**
 * 重新创建渲染器
 */
function resetRenderer(): void {
  md = createMarkdownRenderer();
  const currentTheme = themeStore.isDarkMode ? 'dark' : 'default';
  updateMermaidTheme(currentTheme);
  
  lastRenderedContent = '';
  if (content.value) {
    renderMarkdown(content.value);
  }
}

// 计算 data-theme 属性值
const dataTheme = computed(() => themeStore.isDarkMode ? 'dark' : 'light');

// 拖动相关状态
let startY = 0;
let startHeight = 0;
let currentHandle: HTMLDivElement | null = null;

const onMouseMove = (e: MouseEvent) => {
  const delta = startY - e.clientY; // 向上拖动增加高度
  
  // 获取编辑器容器高度作为最大限制
  const editorView = state.value.view;
  const maxHeight = editorView
    ? (editorView.dom.parentElement?.clientHeight || editorView.dom.clientHeight)
    : 9999;
  
  const newHeight = Math.max(10, Math.min(maxHeight, startHeight + delta));
  markdownPreviewManager.updateHeight(newHeight);
};

const onMouseUp = () => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  if (currentHandle) {
    currentHandle.classList.remove('dragging');
  }
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
};

const onMouseDown = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  startY = e.clientY;
  startHeight = height.value;
  currentHandle = resizeHandleRef.value;
  if (currentHandle) {
    currentHandle.classList.add('dragging');
  }
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

/**
 * 清理拖动事件
 */
function cleanupResize(): void {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

/**
 * 处理链接点击
 */
function handleLinkClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const anchor = target.closest('a');
  if (!anchor) return;

  const href = anchor.getAttribute('href');

  // 处理锚点跳转
  if (href && href.startsWith('#')) {
    e.preventDefault();
    const targetId = href.substring(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement && contentRef.value?.contains(targetElement)) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  // 处理外部链接
  if (href && !href.startsWith('#')) {
    e.preventDefault();
    if (isValidUrl(href)) {
      runtime.Browser.OpenURL(href);
    } else {
      console.warn('Invalid or relative link:', href);
    }
    return;
  }

  // data-href 属性处理
  const dataHref = anchor.getAttribute('data-href');
  if (dataHref) {
    e.preventDefault();
    if (isValidUrl(dataHref)) {
      runtime.Browser.OpenURL(dataHref);
    }
  }
}

/**
 * 验证 URL 是否有效
 */
function isValidUrl(url: string): boolean {
  try {
    if (url.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:/)) {
      const parsedUrl = new URL(url);
      const allowedProtocols = ['http:', 'https:', 'mailto:', 'file:', 'ftp:'];
      return allowedProtocols.includes(parsedUrl.protocol);
    }
    return false;
  } catch {
    return false;
  }
}

// 面板样式
const panelStyle = computed(() => ({
  height: `${height.value}px`
}));

// 创建防抖渲染函数
const { debouncedFn: debouncedRender, cancel: cancelDebounce } = createDebounce(
  (newContent: string) => {
    if (isVisible.value && newContent) {
      renderMarkdown(newContent);
    }
  },
  { delay: 500 }
);

// 监听内容变化
watch(
  content,
  (newContent) => {
    if (isVisible.value && newContent) {
      debouncedRender(newContent);
    }
  },
  { immediate: true }
);

// 监听主题变化
watch(() => themeStore.isDarkMode, resetRenderer);

// 监听可见性变化，初始化/清理拖动
watch(isVisible, async (visible) => {
  if (visible) {
    await nextTick();
    // 初始化拖动手柄
    const handle = resizeHandleRef.value;
    if (handle) {
      handle.addEventListener('mousedown', onMouseDown);
    }
    if (content.value) {
      renderMarkdown(content.value);
    }
  } else {
    // 清理拖动事件
    const handle = resizeHandleRef.value;
    if (handle) {
      handle.removeEventListener('mousedown', onMouseDown);
    }
    cleanupResize();
    
    cancelDebounce();
    renderedHtml.value = '';
    lastRenderedContent = '';
  }
});

// 组件卸载时清理
onUnmounted(() => {
  isDestroyed = true;
  cancelDebounce();
  cleanupResize();
  lastRenderedContent = '';
});
</script>

<template>
  <transition name="preview-slide">
    <div
      v-if="isVisible"
      ref="panelRef"
      class="cm-markdown-preview-panel"
      :style="panelStyle"
    >
      <!-- 拖动调整手柄 -->
      <div ref="resizeHandleRef" class="cm-preview-resize-handle">
        <div class="resize-indicator"></div>
      </div>

      <!-- 预览内容 -->
      <div
        ref="contentRef"
        class="cm-preview-content markdown-body"
        :data-theme="dataTheme"
        @click="handleLinkClick"
        v-html="renderedHtml"
      ></div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.cm-markdown-preview-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  min-height: 10px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
}

.cm-preview-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  background: transparent;
  transition: background-color 0.2s ease;
}

.cm-preview-resize-handle:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
}

.cm-preview-resize-handle.dragging {
  background: var(--bg-hover, rgba(66, 133, 244, 0.1));
}

.resize-indicator {
  width: 40px;
  height: 3px;
  border-radius: 2px;
  background: var(--border-color, rgba(255, 255, 255, 0.2));
  transition: background-color 0.2s ease;
}

.cm-preview-resize-handle:hover .resize-indicator {
  background: var(--text-muted, rgba(255, 255, 255, 0.4));
}

.cm-preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 45px;
  box-sizing: border-box;
  position: relative; /* 为绝对定位的 loading/error 提供定位上下文 */
}

/* ========== macOS 窗口风格代码块（主题适配）========== */
.cm-preview-content.markdown-body {
  :deep(pre) {
    position: relative;
    padding-top: 40px !important;
  }

  /* 暗色主题 */
  &[data-theme="dark"] {
    :deep(pre) {
      /* macOS 窗口顶部栏 */
      &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 28px;
        background-color: #1c1c1e;
        border-bottom: 1px solid rgba(48, 54, 61, 0.5);
        border-radius: 6px 6px 0 0;
        z-index: 1;
      }

      /* macOS 三个控制按钮 */
      &::after {
        content: "";
        position: absolute;
        top: 10px;
        left: 12px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #ec6a5f;
        box-shadow: 18px 0 0 0 #f4bf4f, 36px 0 0 0 #61c554;
        z-index: 2;
      }
    }
  }

  /* 亮色主题 */
  &[data-theme="light"] {
    :deep(pre) {
      /* macOS 窗口顶部栏 */
      &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 28px;
        background-color: #e8e8e8;
        border-bottom: 1px solid #d1d1d6;
        border-radius: 6px 6px 0 0;
        z-index: 1;
      }

      /* macOS 三个控制按钮 */
      &::after {
        content: "";
        position: absolute;
        top: 10px;
        left: 12px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #ff5f57;
        box-shadow: 18px 0 0 0 #febc2e, 36px 0 0 0 #28c840;
        z-index: 2;
      }
    }
  }
}

/* Loading 和 Error 状态 - 居中显示 */
.cm-preview-content :deep(.markdown-loading),
.cm-preview-content :deep(.markdown-error) {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  font-size: 14px;
  color: var(--text-muted, #7d8590);
  text-align: center;
  margin: 0;
  padding: 0;
}

.cm-preview-content :deep(.markdown-error) {
  color: #f85149;
  font-weight: 500;
}

/* 过渡动画 - 从下往上弹起 */
.preview-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.6, 1);
}

.preview-slide-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.preview-slide-enter-to {
  transform: translateY(0);
  opacity: 1;
}

.preview-slide-leave-from {
  transform: translateY(0);
  opacity: 1;
}

.preview-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>

