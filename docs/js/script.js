/**
 * VoidRaft - Website Script
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize components
  initThemeToggle();
  initLanguageToggle();
  initCardEffects();
  
  // Console branding
  console.log('%c VoidRaft', 'color: #ff006e; font-size: 20px; font-family: "Space Mono", monospace;');
  console.log('%c An elegant text snippet recording tool designed for developers.', 'color: #073B4C; font-family: "Space Mono", monospace;');
});

/**
 * Initialize theme toggle functionality
 */
function initThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;
  
  // Get initial theme from local storage or system preference
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const savedTheme = localStorage.getItem('theme');
  const theme = savedTheme || (prefersDarkScheme.matches ? 'dark' : 'light');
  
  // Apply initial theme
  setTheme(theme);
  
  // Add click handler
  themeToggle.addEventListener('click', () => {
    document.body.classList.add('theme-transition');
    
    const currentTheme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Remove transition class after animation completes
    setTimeout(() => document.body.classList.remove('theme-transition'), 300);
  });
}

/**
 * Set theme to dark or light
 * @param {string} theme - 'dark' or 'light'
 */
function setTheme(theme) {
  const isDark = theme === 'dark';
  
  // Update body class
  document.body.classList.toggle('theme-dark', isDark);
  document.body.classList.toggle('theme-light', !isDark);
  
  // Update toggle icon
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (icon) {
      icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
  }
}

/**
 * Initialize language toggle functionality
 */
function initLanguageToggle() {
  const langToggle = document.getElementById('lang-toggle');
  if (!langToggle) return;
  
  // Get initial language from local storage or browser preference
  const savedLang = localStorage.getItem('lang');
  const userLang = navigator.language || navigator.userLanguage;
  const defaultLang = userLang.includes('zh') ? 'zh' : 'en';
  const lang = savedLang || defaultLang;
  
  // Set current language and apply it
  window.currentLang = lang;
  setLanguage(lang);
  
  // Add click handler
  langToggle.addEventListener('click', () => {
    document.body.classList.add('lang-transition');
    
    const newLang = window.currentLang === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
    window.currentLang = newLang;
    localStorage.setItem('lang', newLang);
    
    // Notify other components about language change
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: newLang } }));
    
    // Remove transition class after animation completes
    setTimeout(() => document.body.classList.remove('lang-transition'), 300);
  });
}

/**
 * Set page language
 * @param {string} lang - 'zh' or 'en'
 */
function setLanguage(lang) {
  // Update all elements with data-zh and data-en attributes
  document.querySelectorAll('[data-zh][data-en]').forEach(el => {
    el.textContent = el.getAttribute(`data-${lang}`);
  });
  
  // Update HTML language attribute
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  
  // Update toggle button text
  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    const text = lang === 'zh' ? 'EN/中' : '中/EN';
    langToggle.innerHTML = `<i class="fas fa-language"></i> ${text}`;
  }
}

/**
 * Initialize card hover effects
 */
function initCardEffects() {
  const cards = document.querySelectorAll('.feature-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-8px)';
      card.style.boxShadow = '7px 7px 0 var(--shadow-color)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '5px 5px 0 var(--shadow-color)';
    });
  });
} 