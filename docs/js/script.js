/**
 * voidraft - Website Script
 */

/**
 * 主题管理类
 */
class ThemeManager {
  constructor() {
    this.themeToggle = document.getElementById('theme-toggle');
    this.currentTheme = this.getInitialTheme();
    this.init();
  }

  /**
   * 获取初始主题
   */
  getInitialTheme() {
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || (prefersDarkScheme.matches ? 'dark' : 'light');
  }

  /**
   * 初始化主题管理器
   */
  init() {
    if (!this.themeToggle) return;
    
    this.setTheme(this.currentTheme);
    this.bindEvents();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    this.themeToggle.addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  /**
   * 切换主题
   */
  toggleTheme() {
    document.body.classList.add('theme-transition');
    
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    this.saveTheme(newTheme);
    
    setTimeout(() => document.body.classList.remove('theme-transition'), 300);
  }

  /**
   * 设置主题
   * @param {string} theme - 'dark' 或 'light'
   */
  setTheme(theme) {
    this.currentTheme = theme;
    const isDark = theme === 'dark';
    
    document.body.classList.toggle('theme-dark', isDark);
    document.body.classList.toggle('theme-light', !isDark);
    
    this.updateToggleIcon(isDark);
  }

  /**
   * 更新切换按钮图标
   * @param {boolean} isDark - 是否为暗色主题
   */
  updateToggleIcon(isDark) {
    if (this.themeToggle) {
      const icon = this.themeToggle.querySelector('i');
      if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      }
    }
  }

  /**
   * 保存主题到本地存储
   * @param {string} theme - 主题名称
   */
  saveTheme(theme) {
    localStorage.setItem('theme', theme);
  }
}

/**
 * 语言管理类
 */
class LanguageManager {
  constructor() {
    this.langToggle = document.getElementById('lang-toggle');
    this.currentLang = this.getInitialLanguage();
    this.init();
  }

  /**
   * 获取初始语言
   */
  getInitialLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    const savedLang = localStorage.getItem('lang');
    const browserLang = navigator.language.startsWith('zh') ? 'zh' : 'en';
    return urlLang || savedLang || browserLang;
  }

  /**
   * 初始化语言管理器
   */
  init() {
    if (!this.langToggle) return;
    
    window.currentLang = this.currentLang;
    this.setLanguage(this.currentLang);
    this.bindEvents();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    this.langToggle.addEventListener('click', () => {
      this.toggleLanguage();
    });
  }

  /**
   * 切换语言
   */
  toggleLanguage() {
    document.body.classList.add('lang-transition');
    
    const newLang = this.currentLang === 'zh' ? 'en' : 'zh';
    this.setLanguage(newLang);
    this.saveLanguage(newLang);
    this.updateURL(newLang);
    this.notifyLanguageChange(newLang);
    
    setTimeout(() => document.body.classList.remove('lang-transition'), 300);
  }

  /**
   * 设置页面语言
   * @param {string} lang - 'zh' 或 'en'
   */
  setLanguage(lang) {
    this.currentLang = lang;
    window.currentLang = lang;
    
    this.updatePageElements(lang);
    this.updateHTMLLang(lang);
    this.updateToggleButton(lang);
  }

  /**
   * 更新页面元素文本
   * @param {string} lang - 语言代码
   */
  updatePageElements(lang) {
    document.querySelectorAll('[data-zh][data-en]').forEach(el => {
      el.textContent = el.getAttribute(`data-${lang}`);
    });
  }

  /**
   * 更新HTML语言属性
   * @param {string} lang - 语言代码
   */
  updateHTMLLang(lang) {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }

  /**
   * 更新切换按钮文本
   * @param {string} lang - 语言代码
   */
  updateToggleButton(lang) {
    if (this.langToggle) {
      const text = lang === 'zh' ? 'EN/中' : '中/EN';
      this.langToggle.innerHTML = `<i class="fas fa-language"></i> ${text}`;
    }
  }

  /**
   * 保存语言到本地存储
   * @param {string} lang - 语言代码
   */
  saveLanguage(lang) {
    localStorage.setItem('lang', lang);
  }

  /**
   * 更新URL参数
   * @param {string} lang - 语言代码
   */
  updateURL(lang) {
    const newUrl = new URL(window.location);
    if (lang === 'zh') {
      newUrl.searchParams.set('lang', 'zh');
    } else {
      newUrl.searchParams.delete('lang');
    }
    window.history.replaceState({}, '', newUrl);
  }

  /**
   * 通知语言变更
   * @param {string} lang - 语言代码
   */
  notifyLanguageChange(lang) {
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage() {
    return this.currentLang;
  }
}

/**
 * SEO管理类
 */
class SEOManager {
  constructor(languageManager) {
    this.languageManager = languageManager;
    this.metaTexts = {
      en: {
        description: 'voidraft is an elegant text snippet recording tool designed for developers. Features multi-language code blocks, syntax highlighting, code formatting, custom themes, and more.',
        title: 'voidraft - An elegant text snippet recording tool designed for developers.',
        ogTitle: 'voidraft - An elegant text snippet recording tool designed for developers'
      },
      zh: {
        description: 'voidraft 是专为开发者打造的优雅文本片段记录工具。支持多语言代码块、语法高亮、代码格式化、自定义主题等功能。',
        title: 'voidraft - 专为开发者打造的优雅文本片段记录工具',
        ogTitle: 'voidraft - 专为开发者打造的优雅文本片段记录工具'
      }
    };
    this.init();
  }

  /**
   * 初始化SEO管理器
   */
  init() {
    this.bindEvents();
    this.updateMetaTags(this.languageManager.getCurrentLanguage());
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    window.addEventListener('languageChanged', (event) => {
      this.updateMetaTags(event.detail.lang);
    });
  }

  /**
   * 更新SEO元标签
   * @param {string} lang - 当前语言
   */
  updateMetaTags(lang) {
    const texts = this.metaTexts[lang];
    
    this.updateMetaDescription(texts.description);
    this.updateOpenGraphTags(texts.ogTitle, texts.description);
    this.updateTwitterCardTags(texts.ogTitle, texts.description);
    this.updatePageTitle(texts.title);
  }

  /**
   * 更新meta描述
   * @param {string} description - 描述文本
   */
  updateMetaDescription(description) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = description;
    }
  }

  /**
   * 更新Open Graph标签
   * @param {string} title - 标题
   * @param {string} description - 描述
   */
  updateOpenGraphTags(title, description) {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    
    if (ogTitle) ogTitle.content = title;
    if (ogDesc) ogDesc.content = description;
  }

  /**
   * 更新Twitter Card标签
   * @param {string} title - 标题
   * @param {string} description - 描述
   */
  updateTwitterCardTags(title, description) {
    const twitterTitle = document.querySelector('meta[property="twitter:title"]');
    const twitterDesc = document.querySelector('meta[property="twitter:description"]');
    
    if (twitterTitle) twitterTitle.content = title;
    if (twitterDesc) twitterDesc.content = description;
  }

  /**
   * 更新页面标题
   * @param {string} title - 标题
   */
  updatePageTitle(title) {
    document.title = title;
  }
}

/**
 * UI效果管理类
 */
class UIEffects {
  constructor() {
    this.init();
  }

  /**
   * 初始化UI效果
   */
  init() {
    this.initCardEffects();
  }

  /**
   * 初始化卡片悬停效果
   */
  initCardEffects() {
    const cards = document.querySelectorAll('.feature-card');
    
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        this.animateCardHover(card, true);
      });
      
      card.addEventListener('mouseleave', () => {
        this.animateCardHover(card, false);
      });
    });
  }

  /**
   * 卡片悬停动画
   * @param {Element} card - 卡片元素
   * @param {boolean} isHover - 是否悬停
   */
  animateCardHover(card, isHover) {
    if (isHover) {
      card.style.transform = 'translateY(-8px)';
      card.style.boxShadow = '7px 7px 0 var(--shadow-color)';
    } else {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '5px 5px 0 var(--shadow-color)';
    }
  }
}

/**
 * voidraft主应用类
 */
class voidraftApp {
  constructor() {
    this.themeManager = null;
    this.languageManager = null;
    this.seoManager = null;
    this.uiEffects = null;
    this.init();
  }

  /**
   * 初始化应用
   */
  init() {
    this.initializeManagers();
    this.showConsoleBranding();
  }

  /**
   * 初始化各个管理器
   */
  initializeManagers() {
    this.themeManager = new ThemeManager();
    this.languageManager = new LanguageManager();
    this.seoManager = new SEOManager(this.languageManager);
    this.uiEffects = new UIEffects();
  }

  /**
   * 显示控制台品牌信息
   */
  showConsoleBranding() {
    console.log('%c voidraft', 'color: #ff006e; font-size: 20px; font-family: "Space Mono", monospace;');
    console.log('%c An elegant text snippet recording tool designed for developers.', 'color: #073B4C; font-family: "Space Mono", monospace;');
  }

  /**
   * 获取主题管理器
   */
  getThemeManager() {
    return this.themeManager;
  }

  /**
   * 获取语言管理器
   */
  getLanguageManager() {
    return this.languageManager;
  }

  /**
   * 获取SEO管理器
   */
  getSEOManager() {
    return this.seoManager;
  }

  /**
   * 获取UI效果管理器
   */
  getUIEffects() {
    return this.uiEffects;
  }
}

// 当DOM加载完成时初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.voidRaftApp = new voidraftApp();
});