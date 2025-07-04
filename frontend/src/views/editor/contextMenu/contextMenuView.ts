/**
 * 上下文菜单视图实现
 * 处理菜单的创建、定位和事件绑定
 * 优化为单例模式，避免频繁创建和销毁DOM元素
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

// 菜单DOM元素缓存
let menuElement: HTMLElement | null = null;
let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
// 子菜单缓存池
let submenuPool: Map<string, HTMLElement> = new Map();

/**
 * 获取或创建菜单DOM元素
 */
function getOrCreateMenuElement(): HTMLElement {
  if (!menuElement) {
    menuElement = document.createElement("div");
    menuElement.className = "cm-context-menu";
    menuElement.style.display = "none";
    document.body.appendChild(menuElement);
    
    // 阻止菜单内右键点击冒泡
    menuElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });
  }
  return menuElement;
}

/**
 * 创建或获取子菜单元素
 * @param id 子菜单唯一标识
 */
function getOrCreateSubmenu(id: string): HTMLElement {
  if (!submenuPool.has(id)) {
    const submenu = document.createElement("div");
    submenu.className = "cm-context-menu cm-context-submenu";
    submenu.style.display = "none";
    document.body.appendChild(submenu);
    submenuPool.set(id, submenu);
    
    // 阻止子菜单点击事件冒泡
    submenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  return submenuPool.get(id)!;
}

/**
 * 创建菜单项DOM元素
 */
function createMenuItemElement(item: MenuItem, view: EditorView): HTMLElement {
  // 创建菜单项容器
  const menuItem = document.createElement("div");
  menuItem.className = "cm-context-menu-item";
  
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
  
  // 如果有子菜单，创建或获取子菜单
  if (item.submenu && item.submenu.length > 0) {
    // 使用菜单项标签作为子菜单ID
    const submenuId = `submenu-${item.label.replace(/\s+/g, '-').toLowerCase()}`;
    const submenu = getOrCreateSubmenu(submenuId);
    
    // 清空现有子菜单内容
    while (submenu.firstChild) {
      submenu.removeChild(submenu.firstChild);
    }
    
    // 添加子菜单项
    item.submenu.forEach(subItem => {
      const subMenuItemElement = createMenuItemElement(subItem, view);
      submenu.appendChild(subMenuItemElement);
    });
    
    // 初始状态设置为隐藏
    submenu.style.opacity = '0';
    submenu.style.pointerEvents = 'none';
    submenu.style.visibility = 'hidden';
    submenu.style.display = 'block';
    
    // 当鼠标悬停在菜单项上时，显示子菜单
    menuItem.addEventListener('mouseenter', () => {
      const rect = menuItem.getBoundingClientRect();
      
      // 计算子菜单位置
      submenu.style.left = `${rect.right}px`;
      submenu.style.top = `${rect.top}px`;
      
      // 检查子菜单是否会超出屏幕右侧
      setTimeout(() => {
        const submenuRect = submenu.getBoundingClientRect();
        if (submenuRect.right > window.innerWidth) {
          // 如果会超出右侧，则显示在左侧
          submenu.style.left = `${rect.left - submenuRect.width}px`;
        }
        
        // 检查子菜单是否会超出屏幕底部
        if (submenuRect.bottom > window.innerHeight) {
          // 如果会超出底部，则向上调整
          const newTop = rect.top - (submenuRect.bottom - window.innerHeight);
          submenu.style.top = `${Math.max(0, newTop)}px`;
        }
      }, 0);
      
      // 显示子菜单
      submenu.style.opacity = '1';
      submenu.style.pointerEvents = 'auto';
      submenu.style.visibility = 'visible';
      submenu.style.transform = 'translateX(0)';
    });
    
    // 当鼠标离开菜单项时，隐藏子菜单
    menuItem.addEventListener('mouseleave', (e) => {
      // 检查是否移动到子菜单上
      const toElement = e.relatedTarget as HTMLElement;
      if (submenu.contains(toElement)) {
        return; // 如果移动到子菜单上，不隐藏
      }
      
      // 隐藏子菜单
      submenu.style.opacity = '0';
      submenu.style.pointerEvents = 'none';
      submenu.style.transform = 'translateX(10px)';
      
      // 延迟设置visibility，以便过渡动画能够完成
      setTimeout(() => {
        if (submenu.style.opacity === '0') {
          submenu.style.visibility = 'hidden';
        }
      }, 200);
    });
    
    // 当鼠标离开子菜单时，隐藏它
    submenu.addEventListener('mouseleave', (e) => {
      // 检查是否移动回父菜单项
      const toElement = e.relatedTarget as HTMLElement;
      if (menuItem.contains(toElement)) {
        return; // 如果移动回父菜单项，不隐藏
      }
      
      // 隐藏子菜单
      submenu.style.opacity = '0';
      submenu.style.pointerEvents = 'none';
      submenu.style.transform = 'translateX(10px)';
      
      // 延迟设置visibility，以便过渡动画能够完成
      setTimeout(() => {
        if (submenu.style.opacity === '0') {
          submenu.style.visibility = 'hidden';
        }
      }, 200);
    });
    
    // 记录子菜单
    if (!window.cmSubmenus) {
      window.cmSubmenus = new Map();
    }
    window.cmSubmenus.set(submenuId, submenu);
  }
  
  // 点击事件（仅当有command时添加）
  if (item.command) {
    menuItem.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 添加点击动画效果
      const ripple = document.createElement("div");
      ripple.className = "cm-context-menu-item-ripple";
      
      // 计算相对位置
      const rect = menuItem.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      ripple.style.left = (x - 50) + "px";
      ripple.style.top = (y - 50) + "px";
      
      menuItem.appendChild(ripple);
      
      // 执行点击动画
      setTimeout(() => {
        ripple.style.transform = "scale(1)";
        ripple.style.opacity = "0";
        
        // 动画完成后移除ripple元素
        setTimeout(() => {
          if (ripple.parentNode === menuItem) {
            menuItem.removeChild(ripple);
          }
        }, 300);
      }, 10);
      
      // 执行命令
      item.command!(view);
      
      // 隐藏菜单
      hideContextMenu();
    });
  }
  
  return menuItem;
}

/**
 * 创建分隔线
 */
function createDivider(): HTMLElement {
  const divider = document.createElement("div");
  divider.className = "cm-context-menu-divider";
  return divider;
}

/**
 * 添加菜单组
 * @param menuElement 菜单元素
 * @param title 菜单组标题
 * @param items 菜单项
 * @param view 编辑器视图
 */
function addMenuGroup(menuElement: HTMLElement, title: string | null, items: MenuItem[], view: EditorView): void {
  // 如果有标题，添加组标题
  if (title) {
    const groupTitle = document.createElement("div");
    groupTitle.className = "cm-context-menu-group-title";
    groupTitle.textContent = title;
    menuElement.appendChild(groupTitle);
  }
  
  // 添加菜单项
  items.forEach(item => {
    const menuItemElement = createMenuItemElement(item, view);
    menuElement.appendChild(menuItemElement);
  });
}

/**
 * 显示上下文菜单
 */
export function showContextMenu(view: EditorView, clientX: number, clientY: number, items: MenuItem[]): void {
  // 获取或创建菜单元素
  const menu = getOrCreateMenuElement();
  
  // 如果已经有菜单显示，先隐藏所有子菜单
  hideAllSubmenus();
  
  // 清空现有菜单项
  while (menu.firstChild) {
    menu.removeChild(menu.firstChild);
  }
  
  // 添加主菜单项
  items.forEach(item => {
    const menuItemElement = createMenuItemElement(item, view);
    menu.appendChild(menuItemElement);
  });
  
  // 显示菜单
  menu.style.display = "block";
  
  // 定位菜单
  positionMenu(menu, clientX, clientY);

  
  // 添加点击外部关闭事件
  if (clickOutsideHandler) {
    document.removeEventListener("click", clickOutsideHandler, true);
  }
  
  clickOutsideHandler = (e: MouseEvent) => {
    // 检查点击是否在菜单外
    if (menu && !menu.contains(e.target as Node)) {
      let isInSubmenu = false;
      
      // 检查是否点击在子菜单内
      if (window.cmSubmenus) {
        window.cmSubmenus.forEach((submenu) => {
          if (submenu.contains(e.target as Node)) {
            isInSubmenu = true;
          }
        });
      }
      
      if (!isInSubmenu) {
        hideContextMenu();
      }
    }
  };
  
  // 使用捕获阶段确保事件被处理
  document.addEventListener("click", clickOutsideHandler, true);
  
  // ESC键关闭
  document.addEventListener("keydown", handleKeyDown);
  
  // 触发显示动画
  setTimeout(() => {
    if (menu) {
      menu.classList.add("show");
    }
  }, 10);
}

/**
 * 隐藏所有子菜单
 */
function hideAllSubmenus(): void {
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
 * 处理键盘事件
 */
function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    hideContextMenu();
    document.removeEventListener("keydown", handleKeyDown);
  }
}

/**
 * 隐藏上下文菜单
 */
export function hideContextMenu(): void {
  // 隐藏所有子菜单
  hideAllSubmenus();

  if (menuElement) {
    // 添加淡出动画
    menuElement.classList.remove("show");
    menuElement.classList.add("hide");
    
    // 等待动画完成后隐藏（不移除DOM元素）
    setTimeout(() => {
      if (menuElement) {
        menuElement.style.display = "none";
        menuElement.classList.remove("hide");
      }
    }, 150);
  }
  
  if (clickOutsideHandler) {
    document.removeEventListener("click", clickOutsideHandler, true);
    clickOutsideHandler = null;
  }
  
  document.removeEventListener("keydown", handleKeyDown);
}

/**
 * 定位菜单元素
 */
function positionMenu(menu: HTMLElement, clientX: number, clientY: number): void {
  // 获取窗口尺寸
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // 初始位置设置
  let left = clientX;
  let top = clientY;
  
  // 确保菜单在视窗内
  setTimeout(() => {
    // 计算菜单尺寸
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    
    // 确保菜单不会超出右侧边界
    if (left + menuWidth > windowWidth) {
      left = windowWidth - menuWidth - 5;
    }
    
    // 确保菜单不会超出底部边界
    if (top + menuHeight > windowHeight) {
      top = windowHeight - menuHeight - 5;
    }
    
    // 应用位置
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, 0);
} 