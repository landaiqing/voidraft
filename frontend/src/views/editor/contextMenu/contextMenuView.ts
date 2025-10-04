/**
 * 上下文菜单视图实现
 */

import { EditorView } from "@codemirror/view";
import { MenuItem } from "../contextMenu";
import "./contextMenu.css";

// 为Window对象添加cmSubmenus属性
declare global {
  interface Window {
    cmSubmenus?: Map<string, HTMLElement>;
  }
}

/**
 * 菜单项元素池，用于复用DOM元素
 */
class MenuItemPool {
  private pool: HTMLElement[] = [];
  private maxPoolSize = 50; // 最大池大小

  /**
   * 获取或创建菜单项元素
   */
  get(): HTMLElement {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    
    const menuItem = document.createElement("div");
    menuItem.className = "cm-context-menu-item";
    return menuItem;
  }

  /**
   * 回收菜单项元素
   */
  release(element: HTMLElement): void {
    if (this.pool.length < this.maxPoolSize) {
      // 清理元素状态
      element.className = "cm-context-menu-item";
      element.innerHTML = "";
      element.style.cssText = "";
      
      // 移除所有事件监听器（通过克隆节点）
      const cleanElement = element.cloneNode(false) as HTMLElement;
      this.pool.push(cleanElement);
    }
  }

  /**
   * 清空池
   */
  clear(): void {
    this.pool.length = 0;
  }
}

/**
 * 上下文菜单管理器
 */
class ContextMenuManager {
  private static instance: ContextMenuManager;
  
  private menuElement: HTMLElement | null = null;
  private submenuPool: Map<string, HTMLElement> = new Map();
  private menuItemPool = new MenuItemPool();
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private currentView: EditorView | null = null;
  private activeSubmenus: Set<HTMLElement> = new Set();
  private ripplePool: HTMLElement[] = [];
  
  // 事件委托处理器
  private menuClickHandler: ((e: MouseEvent) => void) | null = null;
  private menuMouseHandler: ((e: MouseEvent) => void) | null = null;

  private constructor() {
    this.initializeEventHandlers();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ContextMenuManager {
    if (!ContextMenuManager.instance) {
      ContextMenuManager.instance = new ContextMenuManager();
    }
    return ContextMenuManager.instance;
  }

  /**
   * 初始化事件处理器
   */
  private initializeEventHandlers(): void {
    // 点击事件委托
    this.menuClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const menuItem = target.closest('.cm-context-menu-item') as HTMLElement;
      
      if (menuItem && menuItem.dataset.command) {
        e.preventDefault();
        e.stopPropagation();
        
        // 添加点击动画
        this.addRippleEffect(menuItem, e);
        
        // 执行命令
        const commandName = menuItem.dataset.command;
        const command = this.getCommandByName(commandName);
        if (command && this.currentView) {
          command(this.currentView);
        }
        
        // 隐藏菜单
        this.hide();
      }
    };

    // 鼠标事件委托
    this.menuMouseHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const menuItem = target.closest('.cm-context-menu-item') as HTMLElement;
      
      if (!menuItem) return;

      if (e.type === 'mouseenter') {
        this.handleMenuItemMouseEnter(menuItem);
      } else if (e.type === 'mouseleave') {
        this.handleMenuItemMouseLeave(menuItem, e);
      }
    };

    // 键盘事件处理器
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.hide();
      }
    };

    // 点击外部关闭处理器
    this.clickOutsideHandler = (e: MouseEvent) => {
      if (this.menuElement && !this.isClickInsideMenu(e.target as Node)) {
        this.hide();
      }
    };
  }

  /**
   * 获取或创建主菜单元素
   */
  private getOrCreateMenuElement(): HTMLElement {
    if (!this.menuElement) {
      this.menuElement = document.createElement("div");
      this.menuElement.className = "cm-context-menu";
      this.menuElement.style.display = "none";
      document.body.appendChild(this.menuElement);
      
      // 阻止菜单内右键点击冒泡
      this.menuElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });

      // 添加事件委托
      this.menuElement.addEventListener('click', this.menuClickHandler!);
      this.menuElement.addEventListener('mouseenter', this.menuMouseHandler!, true);
      this.menuElement.addEventListener('mouseleave', this.menuMouseHandler!, true);
    }
    return this.menuElement;
  }

  /**
   * 创建或获取子菜单元素
   */
  private getOrCreateSubmenu(id: string): HTMLElement {
    if (!this.submenuPool.has(id)) {
      const submenu = document.createElement("div");
      submenu.className = "cm-context-menu cm-context-submenu";
      submenu.style.display = "none";
      document.body.appendChild(submenu);
      this.submenuPool.set(id, submenu);
      
      // 阻止子菜单点击事件冒泡
      submenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      // 添加事件委托
      submenu.addEventListener('click', this.menuClickHandler!);
      submenu.addEventListener('mouseenter', this.menuMouseHandler!, true);
      submenu.addEventListener('mouseleave', this.menuMouseHandler!, true);
    }
    return this.submenuPool.get(id)!;
  }

  /**
   * 创建菜单项DOM元素
   */
  private createMenuItemElement(item: MenuItem): HTMLElement {
    const menuItem = this.menuItemPool.get();
    
    // 如果有子菜单，添加相应类
    if (item.submenu && item.submenu.length > 0) {
      menuItem.classList.add("cm-context-menu-item-with-submenu");
    }
    
    // 创建内容容器
    const contentContainer = document.createElement("div");
    contentContainer.className = "cm-context-menu-item-label";
    
    // 标签文本
    const label = document.createElement("span");
    label.textContent = item.label;
    contentContainer.appendChild(label);
    menuItem.appendChild(contentContainer);
    
    // 快捷键提示（如果有）
    if (item.shortcut) {
      const shortcut = document.createElement("span");
      shortcut.className = "cm-context-menu-item-shortcut";
      shortcut.textContent = item.shortcut;
      menuItem.appendChild(shortcut);
    }
    
    // 存储命令信息用于事件委托
    if (item.command) {
      menuItem.dataset.command = this.registerCommand(item.command);
    }
    
    // 处理子菜单
    if (item.submenu && item.submenu.length > 0) {
      const submenuId = `submenu-${item.label.replace(/\s+/g, '-').toLowerCase()}`;
      menuItem.dataset.submenuId = submenuId;
      
      const submenu = this.getOrCreateSubmenu(submenuId);
      this.populateSubmenu(submenu, item.submenu);
      
      // 记录子菜单
      if (!window.cmSubmenus) {
        window.cmSubmenus = new Map();
      }
      window.cmSubmenus.set(submenuId, submenu);
    }
    
    return menuItem;
  }

  /**
   * 填充子菜单内容
   */
  private populateSubmenu(submenu: HTMLElement, items: MenuItem[]): void {
    // 清空现有内容
    while (submenu.firstChild) {
      submenu.removeChild(submenu.firstChild);
    }
    
    // 添加子菜单项
    items.forEach(item => {
      const subMenuItemElement = this.createMenuItemElement(item);
      submenu.appendChild(subMenuItemElement);
    });
    
    // 初始状态设置为隐藏
    submenu.style.opacity = '0';
    submenu.style.pointerEvents = 'none';
    submenu.style.visibility = 'hidden';
    submenu.style.display = 'block';
  }

  /**
   * 命令注册和管理
   */
  private commands: Map<string, (view: EditorView) => void> = new Map();
  private commandCounter = 0;

  private registerCommand(command: (view: EditorView) => void): string {
    const commandId = `cmd_${this.commandCounter++}`;
    this.commands.set(commandId, command);
    return commandId;
  }

  private getCommandByName(commandId: string): ((view: EditorView) => void) | undefined {
    return this.commands.get(commandId);
  }

  /**
   * 处理菜单项鼠标进入事件
   */
  private handleMenuItemMouseEnter(menuItem: HTMLElement): void {
    const submenuId = menuItem.dataset.submenuId;
    if (!submenuId) return;

    const submenu = this.submenuPool.get(submenuId);
    if (!submenu) return;

    const rect = menuItem.getBoundingClientRect();
    
    // 计算子菜单位置
    submenu.style.left = `${rect.right}px`;
    submenu.style.top = `${rect.top}px`;
    
    // 检查子菜单是否会超出屏幕
    requestAnimationFrame(() => {
      const submenuRect = submenu.getBoundingClientRect();
      if (submenuRect.right > window.innerWidth) {
        submenu.style.left = `${rect.left - submenuRect.width}px`;
      }
      
      if (submenuRect.bottom > window.innerHeight) {
        const newTop = rect.top - (submenuRect.bottom - window.innerHeight);
        submenu.style.top = `${Math.max(0, newTop)}px`;
      }
    });
    
    // 显示子菜单
    submenu.style.opacity = '1';
    submenu.style.pointerEvents = 'auto';
    submenu.style.visibility = 'visible';
    submenu.style.transform = 'translateX(0)';
    
    this.activeSubmenus.add(submenu);
  }

  /**
   * 处理菜单项鼠标离开事件
   */
  private handleMenuItemMouseLeave(menuItem: HTMLElement, e: MouseEvent): void {
    const submenuId = menuItem.dataset.submenuId;
    if (!submenuId) return;

    const submenu = this.submenuPool.get(submenuId);
    if (!submenu) return;

    // 检查是否移动到子菜单上
    const toElement = e.relatedTarget as HTMLElement;
    if (submenu.contains(toElement)) {
      return;
    }
    
    this.hideSubmenu(submenu);
  }

  /**
   * 隐藏子菜单
   */
  private hideSubmenu(submenu: HTMLElement): void {
    submenu.style.opacity = '0';
    submenu.style.pointerEvents = 'none';
    submenu.style.transform = 'translateX(10px)';
    
    setTimeout(() => {
      if (submenu.style.opacity === '0') {
        submenu.style.visibility = 'hidden';
      }
    }, 200);
    
    this.activeSubmenus.delete(submenu);
  }

  /**
   * 添加点击波纹效果
   */
  private addRippleEffect(menuItem: HTMLElement, e: MouseEvent): void {
    let ripple: HTMLElement;
    
    if (this.ripplePool.length > 0) {
      ripple = this.ripplePool.pop()!;
    } else {
      ripple = document.createElement("div");
      ripple.className = "cm-context-menu-item-ripple";
    }
    
    // 计算相对位置
    const rect = menuItem.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ripple.style.left = (x - 50) + "px";
    ripple.style.top = (y - 50) + "px";
    ripple.style.transform = "scale(0)";
    ripple.style.opacity = "1";
    
    menuItem.appendChild(ripple);
    
    // 执行动画
    requestAnimationFrame(() => {
      ripple.style.transform = "scale(1)";
      ripple.style.opacity = "0";
      
      setTimeout(() => {
        if (ripple.parentNode === menuItem) {
          menuItem.removeChild(ripple);
          this.ripplePool.push(ripple);
        }
      }, 300);
    });
  }

  /**
   * 检查点击是否在菜单内
   */
  private isClickInsideMenu(target: Node): boolean {
    if (this.menuElement && this.menuElement.contains(target)) {
      return true;
    }
    
    // 检查是否在子菜单内
    for (const submenu of this.activeSubmenus) {
      if (submenu.contains(target)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 定位菜单元素
   */
  private positionMenu(menu: HTMLElement, clientX: number, clientY: number): void {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = clientX;
    let top = clientY;

    requestAnimationFrame(() => {
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      
      if (left + menuWidth > windowWidth) {
        left = windowWidth - menuWidth - 5;
      }
      
      if (top + menuHeight > windowHeight) {
        top = windowHeight - menuHeight - 5;
      }
      
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    });
  }

  /**
   * 显示上下文菜单
   */
  show(view: EditorView, clientX: number, clientY: number, items: MenuItem[]): void {
    this.currentView = view;
    
    // 获取或创建菜单元素
    const menu = this.getOrCreateMenuElement();
    
    // 隐藏所有子菜单
    this.hideAllSubmenus();
    
    // 清空现有菜单项并回收到池中
    while (menu.firstChild) {
      const child = menu.firstChild as HTMLElement;
      if (child.classList.contains('cm-context-menu-item')) {
        this.menuItemPool.release(child);
      }
      menu.removeChild(child);
    }
    
    // 清空命令注册
    this.commands.clear();
    this.commandCounter = 0;
    
    // 添加主菜单项
    items.forEach(item => {
      const menuItemElement = this.createMenuItemElement(item);
      menu.appendChild(menuItemElement);
    });
    
    // 显示菜单
    menu.style.display = "block";
    
    // 定位菜单
    this.positionMenu(menu, clientX, clientY);
    
    // 添加全局事件监听器
    document.addEventListener("click", this.clickOutsideHandler!, true);
    document.addEventListener("keydown", this.keyDownHandler!);
    
    // 触发显示动画
    requestAnimationFrame(() => {
      if (menu) {
        menu.classList.add("show");
      }
    });
  }

  /**
   * 隐藏所有子菜单
   */
  private hideAllSubmenus(): void {
    this.activeSubmenus.forEach(submenu => {
      this.hideSubmenu(submenu);
    });
    this.activeSubmenus.clear();
    
    if (window.cmSubmenus) {
      window.cmSubmenus.forEach((submenu) => {
        submenu.style.opacity = '0';
        submenu.style.pointerEvents = 'none';
        submenu.style.visibility = 'hidden';
        submenu.style.transform = 'translateX(10px)';
      });
    }
  }

  /**
   * 隐藏上下文菜单
   */
  hide(): void {
    // 隐藏所有子菜单
    this.hideAllSubmenus();

    if (this.menuElement) {
      // 添加淡出动画
      this.menuElement.classList.remove("show");
      this.menuElement.classList.add("hide");
      
      // 等待动画完成后隐藏
      setTimeout(() => {
        if (this.menuElement) {
          this.menuElement.style.display = "none";
          this.menuElement.classList.remove("hide");
        }
      }, 150);
    }
    
    // 移除全局事件监听器
    if (this.clickOutsideHandler) {
      document.removeEventListener("click", this.clickOutsideHandler, true);
    }
    
    if (this.keyDownHandler) {
      document.removeEventListener("keydown", this.keyDownHandler);
    }
    
    this.currentView = null;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.hide();
    
    if (this.menuElement) {
      document.body.removeChild(this.menuElement);
      this.menuElement = null;
    }
    
    this.submenuPool.forEach(submenu => {
      if (submenu.parentNode) {
        document.body.removeChild(submenu);
      }
    });
    this.submenuPool.clear();
    
    this.menuItemPool.clear();
    this.commands.clear();
    this.activeSubmenus.clear();
    this.ripplePool.length = 0;
    
    if (window.cmSubmenus) {
      window.cmSubmenus.clear();
    }
  }
}

// 获取单例实例
const contextMenuManager = ContextMenuManager.getInstance();

/**
 * 显示上下文菜单
 */
export function showContextMenu(view: EditorView, clientX: number, clientY: number, items: MenuItem[]): void {
  contextMenuManager.show(view, clientX, clientY, items);
}