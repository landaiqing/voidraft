/**
 * Markdown 预览面板 UI 组件
 */
import {EditorView, Panel, ViewUpdate} from "@codemirror/view";
import MarkdownIt from 'markdown-it';
import * as runtime from "@wailsio/runtime";
import {previewPanelState} from "./state";
import {createMarkdownRenderer} from "./markdownRenderer";
import {updateMermaidTheme} from "@/common/markdown-it/plugins/markdown-it-mermaid";
import {useThemeStore} from "@/stores/themeStore";
import {usePanelStore} from "@/stores/panelStore";
import {watch} from "vue";
import {createDebounce} from "@/common/utils/debounce";
import {morphHTML} from "@/common/utils/domDiff";

/**
 * Markdown 预览面板类
 */
export class MarkdownPreviewPanel {
  private md: MarkdownIt;
  private readonly dom: HTMLDivElement;
  private readonly resizeHandle: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private view: EditorView;
  private themeUnwatch?: () => void;
  private lastRenderedContent: string = "";
  private readonly debouncedUpdate: ReturnType<typeof createDebounce>;
  private isDestroyed: boolean = false; // 标记面板是否已销毁

  constructor(view: EditorView) {
    this.view = view;
    this.md = createMarkdownRenderer();

    // 创建防抖更新函数
    this.debouncedUpdate = createDebounce(() => {
      this.updateContentInternal();
    }, { delay: 500 });

    // 监听主题变化
    const themeStore = useThemeStore();
    this.themeUnwatch = watch(() => themeStore.isDarkMode, (isDark) => {
      const newTheme = isDark ? "dark" : "default";
      updateMermaidTheme(newTheme);
      this.lastRenderedContent = ""; // 清空缓存，强制重新渲染
    });

    // 创建 DOM 结构
    this.dom = document.createElement("div");
    this.dom.className = "cm-markdown-preview-panel";

    this.resizeHandle = document.createElement("div");
    this.resizeHandle.className = "cm-preview-resize-handle";

    this.content = document.createElement("div");
    this.content.className = "cm-preview-content";

    this.dom.appendChild(this.resizeHandle);
    this.dom.appendChild(this.content);

    // 设置默认高度为编辑器高度的一半
    const defaultHeight = Math.floor(this.view.dom.clientHeight / 2);
    this.dom.style.height = `${defaultHeight}px`;

    // 初始化拖动功能
    this.initResize();

    // 初始化链接点击处理
    this.initLinkHandler();

    // 初始渲染
    this.updateContentInternal();
  }

  /**
   * 初始化链接点击处理（事件委托）
   */
  private initLinkHandler(): void {
    this.content.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // 查找最近的 <a> 标签
      let linkElement = target;
      while (linkElement && linkElement !== this.content) {
        if (linkElement.tagName === 'A') {
          const anchor = linkElement as HTMLAnchorElement;
          const href = anchor.getAttribute('href');
          
          // 处理脚注内部锚点链接
          if (href && href.startsWith('#')) {
            e.preventDefault();
            
            // 在预览面板内查找目标元素
            const targetId = href.substring(1);
            
            // 使用 getElementById 而不是 querySelector，因为 ID 可能包含特殊字符（如冒号）
            const targetElement = document.getElementById(targetId);
            
            if (targetElement && this.content.contains(targetElement)) {
              // 平滑滚动到目标元素
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
          }
          
          // 处理带 data-href 的外部链接
          if (anchor.hasAttribute('data-href')) {
            e.preventDefault();
            const url = anchor.getAttribute('data-href');
            if (url && this.isValidUrl(url)) {
              runtime.Browser.OpenURL(url);
            }
            return;
          }
          
          // 处理其他链接
          if (href && !href.startsWith('#')) {
            e.preventDefault();
            
            // 只有有效的 URL（http/https/mailto/file 等）才用浏览器打开
            if (this.isValidUrl(href)) {
            runtime.Browser.OpenURL(href);
            } else {
              // 相对路径或无效链接，显示提示
              console.warn('Invalid or relative link in preview:', href);
            }
            return;
          }
        }
        
        linkElement = linkElement.parentElement as HTMLElement;
      }
    });
  }

  /**
   * 检查是否是有效的 URL（包含协议）
   */
  private isValidUrl(url: string): boolean {
    try {
      // 检查是否包含协议
      if (url.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:/)) {
        const parsedUrl = new URL(url);
        // 允许的协议列表
        const allowedProtocols = ['http:', 'https:', 'mailto:', 'file:', 'ftp:'];
        return allowedProtocols.includes(parsedUrl.protocol);
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 初始化拖动调整高度功能
   */
  private initResize(): void {
    let startY = 0;
    let startHeight = 0;
    
    const onMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const maxHeight = this.getMaxHeight();
      const newHeight = Math.max(100, Math.min(maxHeight, startHeight + delta));
      this.dom.style.height = `${newHeight}px`;
    };
    
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      this.resizeHandle.classList.remove("dragging");
      // 恢复 body 样式
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    
    this.resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startY = e.clientY;
      startHeight = this.dom.offsetHeight;
      this.resizeHandle.classList.add("dragging");
      // 设置 body 样式，防止拖动时光标闪烁
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  /**
   * 动态计算最大高度（编辑器高度）
   */
  private getMaxHeight(): number {
      return this.view.dom.clientHeight;
  }

  /**
   * 内部更新预览内容（带缓存 + DOM Diff 优化）
   */
  private updateContentInternal(): void {
    // 如果面板已销毁，直接返回
    if (this.isDestroyed) {
      return;
    }

    try {
      const state = this.view.state;
      const currentPreviewState = state.field(previewPanelState, false);

      if (!currentPreviewState) {
        return;
      }

      const blockContent = state.doc.sliceString(
        currentPreviewState.blockFrom, 
        currentPreviewState.blockTo
      );

      if (!blockContent || blockContent.trim().length === 0) {
        return;
      }

      // 缓存检查：如果内容没变，不重新渲染
      if (blockContent === this.lastRenderedContent) {
        return;
      }

      // 对于大内容，使用异步渲染避免阻塞主线程
      if (blockContent.length > 1000) {
        this.renderLargeContentAsync(blockContent);
      } else {
        // 小内容使用 DOM Diff 优化渲染
        this.renderWithDiff(blockContent);
      }

    } catch (error) {
      console.warn("Error updating preview content:", error);
    }
  }

  /**
   * 使用 DOM Diff 渲染内容（保留未变化的节点）
   */
  private renderWithDiff(content: string): void {
    // 如果面板已销毁，直接返回
    if (this.isDestroyed) {
      return;
    }

    try {
      const newHtml = this.md.render(content);
      
      // 如果是首次渲染或内容为空，直接设置 innerHTML
      if (!this.lastRenderedContent || this.content.children.length === 0) {
        this.content.innerHTML = newHtml;
      } else {
        // 使用 DOM Diff 增量更新
        morphHTML(this.content, newHtml);
      }
      
      this.lastRenderedContent = content;
    } catch (error) {
      console.warn("Error rendering with diff:", error);
      // 降级到直接设置 innerHTML
      if (!this.isDestroyed) {
        this.content.innerHTML = this.md.render(content);
        this.lastRenderedContent = content;
      }
    }
  }

  /**
   * 异步渲染大内容（使用 DOM Diff 优化）
   */
  private renderLargeContentAsync(content: string): void {
    // 如果面板已销毁，直接返回
    if (this.isDestroyed) {
      return;
    }

    // 如果是首次渲染，显示加载状态
    if (!this.lastRenderedContent) {
    this.content.innerHTML = '<div class="markdown-loading">Rendering...</div>';
    }
    
    // 使用 requestIdleCallback 在浏览器空闲时渲染
    const callback = window.requestIdleCallback || ((cb: IdleRequestCallback) => setTimeout(cb, 1));
    
    callback(() => {
      // 再次检查是否已销毁（异步回调时可能已经关闭）
      if (this.isDestroyed) {
        return;
      }

      try {
        const html = this.md.render(content);
        
        // 如果是首次渲染或之前内容为空，直接设置
        if (!this.lastRenderedContent || this.content.children.length === 0) {
        // 使用 DocumentFragment 减少 DOM 操作
        const fragment = document.createRange().createContextualFragment(html);
        this.content.innerHTML = '';
        this.content.appendChild(fragment);
        } else {
          // 使用 DOM Diff 增量更新（保留滚动位置和未变化的节点）
          morphHTML(this.content, html);
        }
        
        this.lastRenderedContent = content;
      } catch (error) {
        console.warn("Error rendering large content:", error);
        if (!this.isDestroyed) {
        this.content.innerHTML = '<div class="markdown-error">Render failed</div>';
        }
      }
    });
  }

  /**
   * 响应编辑器更新
   */
  public update(update: ViewUpdate): void {
    if (update.docChanged) {
      // 文档改变时使用防抖更新
      this.debouncedUpdate.debouncedFn();
    } else if (update.selectionSet) {
      // 光标移动时不触发更新
      // 如果需要根据光标位置更新，可以在这里处理
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    // 标记为已销毁，防止异步回调继续执行
    this.isDestroyed = true;

    // 清理防抖
    if (this.debouncedUpdate) {
      this.debouncedUpdate.cancel();
    }
    
    // 清空缓存
    this.lastRenderedContent = "";
  }

  /**
   * 获取 CodeMirror Panel 对象
   */
  public getPanel(): Panel {
    return {
      top: false,
      dom: this.dom,
      update: (update: ViewUpdate) => this.update(update),
      destroy: () => this.destroy()
    };
  }
}

/**
 * 创建预览面板
 */
export function createPreviewPanel(view: EditorView): Panel {
  const panel = new MarkdownPreviewPanel(view);
  return panel.getPanel();
}

