import { EditorView, Tooltip, TooltipView } from '@codemirror/view';
import { useTranslationStore } from '@/stores/translationStore';

// 创建翻译气泡弹窗
export class TranslationTooltip implements TooltipView {
  dom: HTMLElement;
  sourceText: string;
  translationStore: ReturnType<typeof useTranslationStore>;
  
  // UI元素
  private translatorSelector: HTMLSelectElement;
  private sourceLangSelector: HTMLSelectElement;
  private targetLangSelector: HTMLSelectElement;
  private resultContainer: HTMLDivElement;
  private loadingIndicator: HTMLDivElement;
  private translatedText: string = '';
  private detectedSourceLang: string = ''; // 保存检测到的语言代码
  
  constructor(_view: EditorView, text: string) {
    this.sourceText = text;
    this.translationStore = useTranslationStore();
    
    // 创建气泡弹窗容器
    this.dom = document.createElement('div');
    this.dom.className = 'cm-translation-tooltip';
    
    // 创建头部控制区域 - 固定在顶部
    const header = document.createElement('div');
    header.className = 'cm-translation-header';
    
    // 控制选项容器 - 所有选择器在一行
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'cm-translation-controls';
    
    // 创建选择器（初始为空，稍后填充）
    this.sourceLangSelector = document.createElement('select');
    this.sourceLangSelector.className = 'cm-translation-select';
    
    // 交换语言按钮
    const swapButton = document.createElement('button');
    swapButton.className = 'cm-translation-swap';
    swapButton.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M7.5 21L3 16.5L7.5 12L9 13.5L7 15.5H15V13H17V17.5H7L9 19.5L7.5 21M16.5 3L21 7.5L16.5 12L15 10.5L17 8.5H9V11H7V6.5H17L15 4.5L16.5 3Z"/></svg>`;
    
    // 目标语言选择
    this.targetLangSelector = document.createElement('select');
    this.targetLangSelector.className = 'cm-translation-select';
    
    // 创建一个临时的翻译器选择器，稍后会被替换
    this.translatorSelector = document.createElement('select');
    this.translatorSelector.className = 'cm-translation-select';
    const tempOption = document.createElement('option');
    tempOption.textContent = 'Loading...';
    this.translatorSelector.appendChild(tempOption);
    
    // 添加所有控制元素到一行
    controlsContainer.appendChild(this.sourceLangSelector);
    controlsContainer.appendChild(swapButton);
    controlsContainer.appendChild(this.targetLangSelector);
    controlsContainer.appendChild(this.translatorSelector);
    
    // 添加到头部
    header.appendChild(controlsContainer);
    
    // 创建内容滚动区域
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'cm-translation-scroll-container';
    
    // 创建结果区域
    this.resultContainer = document.createElement('div');
    this.resultContainer.className = 'cm-translation-result';
    
    // 加载指示器
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.className = 'cm-translation-loading';
    this.loadingIndicator.textContent = 'Translation...';
    this.loadingIndicator.style.display = 'none';
    
    // 将结果和加载指示器添加到滚动区域
    scrollContainer.appendChild(this.loadingIndicator);
    scrollContainer.appendChild(this.resultContainer);
    
    // 将所有元素添加到主容器
    this.dom.appendChild(header);
    this.dom.appendChild(scrollContainer);
    
    // 添加事件监听
    this.sourceLangSelector.addEventListener('change', () => {
      // 检查源语言和目标语言是否相同
      this.handleLanguageChange();
      this.translate();
    });
    
    this.targetLangSelector.addEventListener('change', () => {
      // 检查源语言和目标语言是否相同
      this.handleLanguageChange();
      
      // 增加选中语言的使用频率
      const targetLang = this.targetLangSelector.value;
      if (targetLang) {
        this.translationStore.incrementLanguageUsage(targetLang);
      }
      
      this.translate();
    });
    
    swapButton.addEventListener('click', () => {
      // 交换语言
      
      const temp = this.sourceLangSelector.value;
      this.sourceLangSelector.value = this.targetLangSelector.value;
      this.targetLangSelector.value = temp;
      this.translate();
    });
    
    // 显示加载中
    this.loadingIndicator.style.display = 'block';
    this.resultContainer.innerHTML = '<div class="cm-translation-loading">Loading...</div>';
    
    // 加载翻译器选项
    this.loadTranslators().then(() => {
      // 尝试自动检测语言
      if (this.sourceText.length >= 10) {
        this.detectedSourceLang = this.translationStore.detectLanguage(this.sourceText);
        if (this.detectedSourceLang) {
          // 如果检测到语言，更新选择器
          this.updateLanguageSelectorsForDetectedLanguage(this.detectedSourceLang);
        }
      }
      
      // 初始翻译
      this.translate();
    });
  }
  
  // 处理语言变更，防止源和目标语言相同
  private handleLanguageChange() {
    // 防止源语言和目标语言相同
    if (this.sourceLangSelector.value === this.targetLangSelector.value) {
      // 寻找一个不同的目标语言
      const options = Array.from(this.targetLangSelector.options);
      for (const option of options) {
        if (option.value !== this.sourceLangSelector.value) {
          this.targetLangSelector.value = option.value;
          break;
        }
      }
    }
  }
  
  // 加载翻译器选项
  private async loadTranslators() {
    try {
      // 确保翻译器列表已加载
      if (!this.translationStore.hasTranslators) {
        await this.translationStore.loadAvailableTranslators();
      }
      
      // 清空现有选项
      while (this.translatorSelector.firstChild) {
        this.translatorSelector.removeChild(this.translatorSelector.firstChild);
      }
      
      // 添加翻译器选项
      const translators = this.translationStore.availableTranslators;
      
      if (translators.length === 0) {
        // 如果没有可用翻译器，添加一个默认选项
        const option = document.createElement('option');
        option.value = 'bing';
        option.textContent = 'Bing';
        this.translatorSelector.appendChild(option);
      } else {
        translators.forEach(translator => {
          const option = document.createElement('option');
          option.value = translator;
          option.textContent = this.getTranslatorDisplayName(translator);
          option.selected = translator === this.translationStore.defaultTranslator;
          this.translatorSelector.appendChild(option);
        });
      }
      
      // 添加事件监听
      this.translatorSelector.addEventListener('change', () => {
              // 更新当前翻译器
      this.translationStore.setDefaultConfig({
        translatorType: this.translatorSelector.value
      });
      
      // 重置检测到的语言
      this.detectedSourceLang = '';
      
      // 当切换翻译器时，可能需要重新排序语言列表
        
        // 加载该翻译器的语言列表
        this.updateLanguageSelectors();
        
        // 执行翻译
        this.translate();
      });
      
      // 加载默认翻译器的语言列表
      await this.updateLanguageSelectors();
      
      return true;
    } catch (error) {
      console.error('Failed to load translators:', error);
      
      // 清空现有选项
      while (this.translatorSelector.firstChild) {
        this.translatorSelector.removeChild(this.translatorSelector.firstChild);
      }
      
      // 添加默认翻译器选项
      const defaultTranslators = ['bing', 'google', 'youdao', 'deepl'];
      defaultTranslators.forEach(translator => {
        const option = document.createElement('option');
        option.value = translator;
        option.textContent = this.getTranslatorDisplayName(translator);
        option.selected = translator === 'bing';
        this.translatorSelector.appendChild(option);
      });
      
      // 添加事件监听
      this.translatorSelector.addEventListener('change', () => {
        // 更新选择器并重新翻译
        this.updateLanguageSelectors();
        this.translate();
      });
      
      // 加载默认翻译器的语言列表
      await this.updateLanguageSelectors();
      
      return false;
    }
  }
  
  // 更新语言选择器
  private async updateLanguageSelectors() {
    const currentTranslator = this.translatorSelector.value;
    
    // 保存当前选中的语言
    const currentSourceLang = this.sourceLangSelector.value || '';
    const currentTargetLang = this.targetLangSelector.value || 'zh';
    
    // 清空源语言选择器
    while (this.sourceLangSelector.firstChild) {
      this.sourceLangSelector.removeChild(this.sourceLangSelector.firstChild);
    }
    
    // 清空目标语言选择器
    while (this.targetLangSelector.firstChild) {
      this.targetLangSelector.removeChild(this.targetLangSelector.firstChild);
    }
    
    // 获取当前翻译器的语言列表
    const languageMap = this.translationStore.currentLanguageMap;
    
    // 如果语言列表为空，直接返回
    if (!languageMap || Object.keys(languageMap).length === 0) {
      return;
    }
    
    // 获取按使用频率排序的语言列表
    const sortedLanguages = this.translationStore.getSortedLanguages(currentTranslator);
    
    // 添加所有语言选项
    if (Array.isArray(sortedLanguages)) {
      // 处理非分组返回值
      sortedLanguages.forEach(([code, langInfo]) => {
        this.addLanguageOption(code, langInfo);
      });
    } else {
      // 处理分组返回值
      // 先添加常用语言
      sortedLanguages.frequent.forEach(([code, langInfo]) => {
        this.addLanguageOption(code, langInfo);
      });
      
      // 再添加其他语言
      sortedLanguages.others.forEach(([code, langInfo]) => {
        this.addLanguageOption(code, langInfo);
      });
    }
    
    // 匹配之前的语言选项或使用默认值
    this.updateSelectedLanguages(currentSourceLang, currentTargetLang, currentTranslator);
  }
  
  // 添加语言选项到选择器
  private addLanguageOption(code: string, langInfo: any) {
    // 使用后端提供的名称，而不是代码
    const displayName = langInfo.Name || langInfo.name || code;
    
    // 源语言选项
    const sourceOption = document.createElement('option');
    sourceOption.value = code;
    sourceOption.textContent = displayName;
    this.sourceLangSelector.appendChild(sourceOption);
    
    // 目标语言选项
    const targetOption = document.createElement('option');
    targetOption.value = code;
    
    // 不再显示使用次数，直接使用语言名称
    targetOption.textContent = displayName;
    
    this.targetLangSelector.appendChild(targetOption);
  }
  
  // 更新选中的语言选项，确保语言代码在当前翻译器中有效
  private updateSelectedLanguages(sourceLang: string, targetLang: string, translatorType: string) {
    // 尝试在当前翻译器中找到匹配的语言代码
    const validSourceLang = this.translationStore.validateLanguage(sourceLang, translatorType);
    
          // 如果找到有效的语言代码，且该代码在选择器中存在，则选中它
      if (validSourceLang && this.hasLanguageOption(this.sourceLangSelector, validSourceLang)) {
        this.sourceLangSelector.value = validSourceLang;
      } else if (this.detectedSourceLang) {
        // 如果没有找到匹配但有检测到的语言，尝试使用它
      const validDetectedLang = this.translationStore.validateLanguage(this.detectedSourceLang, translatorType);
      if (this.hasLanguageOption(this.sourceLangSelector, validDetectedLang)) {
        this.sourceLangSelector.value = validDetectedLang;
      } else if (this.sourceLangSelector.options.length > 0) {
        // 如果没有检测到的语言，使用第一个可用选项
        this.sourceLangSelector.selectedIndex = 0;
      }
    } else if (this.sourceLangSelector.options.length > 0) {
      // 如果没有检测到的语言，使用第一个可用选项
      this.sourceLangSelector.selectedIndex = 0;
    }
    
    // 对于目标语言，尝试找到匹配的语言代码
    const validTargetLang = this.translationStore.validateLanguage(targetLang, translatorType);
    if (this.hasLanguageOption(this.targetLangSelector, validTargetLang)) {
      this.targetLangSelector.value = validTargetLang;
    } else {
      // 如果没有找到匹配，使用默认目标语言或第一个可用选项
      const defaultTarget = this.translationStore.defaultTargetLang;
      if (this.hasLanguageOption(this.targetLangSelector, defaultTarget)) {
        this.targetLangSelector.value = defaultTarget;
      } else if (this.targetLangSelector.options.length > 0) {
        this.targetLangSelector.selectedIndex = 0;
      }
    }
    
    // 确保源语言和目标语言不同
    this.handleLanguageChange();
  }
  
  // 检查选择器是否有指定语言选项
  private hasLanguageOption(selector: HTMLSelectElement, langCode: string): boolean {
    return Array.from(selector.options).some(option => option.value === langCode);
  }

  
  // 为检测到的语言更新语言选择器
  private updateLanguageSelectorsForDetectedLanguage(detectedLang: string) {
    if (!detectedLang) return;
    
    // 根据当前翻译器验证检测到的语言
    const currentTranslator = this.translatorSelector.value;
    const validLang = this.translationStore.validateLanguage(detectedLang, currentTranslator);
    
    // 检查验证后的语言是否在选择器中
    const hasDetectedOption = this.hasLanguageOption(this.sourceLangSelector, validLang);
    
    // 设置检测到的语言为源语言
    if (hasDetectedOption) {
      this.sourceLangSelector.value = validLang;
    }
    
    // 存储检测到的语言代码，以便后续使用
    this.detectedSourceLang = validLang;
  }
  
  // 获取翻译器显示名称
  private getTranslatorDisplayName(translatorType: string): string {
    switch (translatorType) {
      case 'google': return 'Google';
      case 'bing': return 'Bing';
      case 'youdao': return 'YouDao';
      case 'deepl': return 'DeepL';
      default: return translatorType;
    }
  }
  
  // 执行翻译
  private async translate() {
    const targetLang = this.targetLangSelector.value;
    const translatorType = this.translatorSelector.value;
    
    // 显示加载状态
    this.loadingIndicator.style.display = 'block';
    this.resultContainer.innerHTML = '';
    
    try {
      // 执行翻译 - 源语言将在store中自动检测
      const result = await this.translationStore.translateText(
        this.sourceText,
        targetLang,
        translatorType
      );
      
      // 如果检测到了语言，更新源语言选择器
      if (result.sourceLang) {
        this.detectedSourceLang = result.sourceLang;
        this.updateLanguageSelectorsForDetectedLanguage(result.sourceLang);
      }
      
      // 显示翻译结果
      this.displayTranslationResult(result);
      
    } catch (err) {
      console.error('Translation failed:', err);
      this.resultContainer.innerHTML = '';
      this.translatedText = '';
    } finally {
      // 隐藏加载状态
      this.loadingIndicator.style.display = 'none';
    }
  }
  
  // 显示翻译结果
  private displayTranslationResult(result: any) {
    // 更新结果显示
    this.resultContainer.innerHTML = '';
    
    // 创建结果容器
    const resultWrapper = document.createElement('div');
    resultWrapper.className = 'cm-translation-result-wrapper';
    
    // 只显示翻译结果区域
    const translatedTextElem = document.createElement('div');
    translatedTextElem.className = 'cm-translation-target';
    
    if (result.error) {
      translatedTextElem.classList.add('cm-translation-error');
      translatedTextElem.textContent = result.error;
      this.translatedText = '';
    } else {
      this.translatedText = result.translatedText || '';
      translatedTextElem.textContent = this.translatedText || '';
    }
    
    // 添加复制按钮
    if (this.translatedText) {
      const copyButton = document.createElement('button');
      copyButton.className = 'cm-translation-copy-btn';
      copyButton.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
      
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(this.translatedText).then(() => {
          // 显示复制成功提示
          const originalText = copyButton.innerHTML;
          copyButton.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
          copyButton.classList.add('copied');
          
          setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove('copied');
          }, 1500);
        });
      });
      
      // 将复制按钮添加到结果包装器
      resultWrapper.appendChild(copyButton);
    }
    
    // 添加翻译结果到包装器
    resultWrapper.appendChild(translatedTextElem);
    
    // 添加到结果容器
    this.resultContainer.appendChild(resultWrapper);
  }
  
  // 更新默认配置
  private updateDefaultConfig() {
    const targetLang = this.targetLangSelector.value;
    
    // 增加目标语言的使用频率
    if (targetLang) {
      this.translationStore.incrementLanguageUsage(targetLang);
    }
    
    this.translationStore.setDefaultConfig({
      targetLang: targetLang,
      translatorType: this.translatorSelector.value
    });
  }
  
  // 当气泡弹窗被销毁时
  destroy() {
    // 保存当前配置作为默认值
    this.updateDefaultConfig();
  }
}

// 创建翻译气泡
export function createTranslationTooltip(view: EditorView, text: string): Tooltip {
  return {
    pos: view.state.selection.main.to,  // 紧贴文本末尾
    above: false,
    strictSide: false,
    arrow: true,
    create: () => new TranslationTooltip(view, text)
  };
} 