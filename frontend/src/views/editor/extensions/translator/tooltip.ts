import {EditorView, Tooltip, TooltipView} from '@codemirror/view';
import {useTranslationStore} from '@/stores/translationStore';

/**
 * 翻译气泡弹窗类
 * 提供文本翻译功能的交互式界面
 */
export class TranslationTooltip implements TooltipView {
    // ===== 核心属性 =====
    dom!: HTMLElement;
    sourceText: string;
    translationStore: ReturnType<typeof useTranslationStore>;

    // ===== UI 元素 =====
    private translatorSelector!: HTMLSelectElement;
    private sourceLangSelector!: HTMLSelectElement;
    private targetLangSelector!: HTMLSelectElement;
    private resultContainer!: HTMLDivElement;
    private loadingIndicator!: HTMLDivElement;
    private swapButton!: HTMLButtonElement;
    
    // ===== 状态管理 =====
    private translatedText: string = '';
    private eventListeners: Array<{element: HTMLElement | Document, event: string, handler: EventListener}> = [];
    
    // ===== 拖拽状态 =====
    private isDragging: boolean = false;
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

    constructor(_view: EditorView, text: string) {
        this.sourceText = text;
        this.translationStore = useTranslationStore();
        
        this.initializeDOM();
        this.setupEventListeners();
        this.initializeTranslation();
    }

    // ===== DOM 初始化 =====
    
    /**
     * 初始化DOM结构
     */
    private initializeDOM(): void {
        this.dom = this.createElement('div', 'cm-translation-tooltip');
        // 设置为绝对定位，允许拖拽移动
        this.dom.style.position = 'absolute';
        
        const header = this.createHeader();
        const scrollContainer = this.createScrollContainer();
        
        this.dom.appendChild(header);
        this.dom.appendChild(scrollContainer);
    }

    /**
     * 创建头部控制区域
     */
    private createHeader(): HTMLElement {
        const header = this.createElement('div', 'cm-translation-header');
        
        const controlsContainer = this.createElement('div', 'cm-translation-controls');
        
        // 创建所有控制元素
        this.sourceLangSelector = this.createSelector('cm-translation-select');
        this.swapButton = this.createSwapButton();
        this.targetLangSelector = this.createSelector('cm-translation-select');
        this.translatorSelector = this.createTranslatorSelector();
        
        // 添加到控制容器
        controlsContainer.appendChild(this.sourceLangSelector);
        controlsContainer.appendChild(this.swapButton);
        controlsContainer.appendChild(this.targetLangSelector);
        controlsContainer.appendChild(this.translatorSelector);
        
        header.appendChild(controlsContainer);
        return header;
    }

    /**
     * 创建滚动容器
     */
    private createScrollContainer(): HTMLElement {
        const scrollContainer = this.createElement('div', 'cm-translation-scroll-container');
        
        this.loadingIndicator = this.createElement('div', 'cm-translation-loading') as HTMLDivElement;
        this.loadingIndicator.textContent = 'Translation...';
        this.loadingIndicator.style.display = 'none';
        
        this.resultContainer = this.createElement('div', 'cm-translation-result') as HTMLDivElement;
        
        scrollContainer.appendChild(this.loadingIndicator);
        scrollContainer.appendChild(this.resultContainer);
        
        return scrollContainer;
    }

    /**
     * 创建选择器元素
     */
    private createSelector(className: string): HTMLSelectElement {
        const select = this.createElement('select', className) as HTMLSelectElement;
        return select;
    }

    /**
     * 创建语言交换按钮
     */
    private createSwapButton(): HTMLButtonElement {
        const button = this.createElement('button', 'cm-translation-swap') as HTMLButtonElement;
        button.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M7.5 21L3 16.5L7.5 12L9 13.5L7 15.5H15V13H17V17.5H7L9 19.5L7.5 21M16.5 3L21 7.5L16.5 12L15 10.5L17 8.5H9V11H7V6.5H17L15 4.5L16.5 3Z"/></svg>`;
        return button;
    }

    /**
     * 创建翻译器选择器
     */
    private createTranslatorSelector(): HTMLSelectElement {
        const select = this.createSelector('cm-translation-select');
        const tempOption = this.createElement('option') as HTMLOptionElement;
        tempOption.textContent = 'Loading...';
        select.appendChild(tempOption);
        return select;
    }

    /**
     * 通用DOM元素创建方法
     */
    private createElement(tag: string, className?: string): HTMLElement {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        return element;
    }

    // ===== 事件管理 =====
    
    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        this.addEventListenerWithCleanup(this.sourceLangSelector, 'change', () => {
            this.handleLanguageChange();
        });

        this.addEventListenerWithCleanup(this.targetLangSelector, 'change', () => {
            this.handleLanguageChange();
        });

        this.addEventListenerWithCleanup(this.swapButton, 'click', () => {
            this.swapLanguages();
        });

        // 添加拖拽事件监听器
        this.setupDragListeners();
    }

    /**
     * 添加事件监听器并记录以便清理
     */
    private addEventListenerWithCleanup(element: HTMLElement | Document, event: string, handler: EventListener): void {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }

    /**
     * 清理所有事件监听器
     */
    private cleanupEventListeners(): void {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }

    // ===== 初始化和生命周期 =====
    
    /**
     * 初始化翻译功能
     */
    private async initializeTranslation(): Promise<void> {
        this.showLoading();
        this.resultContainer.innerHTML = '<div class="cm-translation-loading">Loading...</div>';
        
        try {
            await this.loadTranslators();
            await this.translate();
        } catch (error) {
            console.error('Failed to initialize translation:', error);
            this.hideLoading();
        }
    }

    // ===== 语言管理 =====
    
    /**
     * 设置拖拽事件监听器
     */
    private setupDragListeners(): void {
        // 在整个翻译框上监听鼠标按下事件
        this.addEventListenerWithCleanup(this.dom, 'mousedown', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            const target = mouseEvent.target as HTMLElement;
            
            // 如果点击的是交互元素（按钮、选择框等），不启动拖拽
            if (target.tagName === 'SELECT' || target.tagName === 'BUTTON' || 
                target.tagName === 'OPTION' || target.closest('select') || target.closest('button')) {
                return;
            }
            
            this.startDrag(mouseEvent);
        });

        // 鼠标移动
        this.addEventListenerWithCleanup(document, 'mousemove', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            this.onDrag(mouseEvent);
        });

        // 鼠标释放结束拖拽
        this.addEventListenerWithCleanup(document, 'mouseup', () => {
            this.endDrag();
        });
    }

    /**
     * 开始拖拽
     */
    private startDrag(e: MouseEvent): void {
        e.preventDefault();
        this.isDragging = true;
        
        const rect = this.dom.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // 添加拖拽状态样式
        this.dom.classList.add('cm-translation-dragging');
        this.dom.style.cursor = 'grabbing';
    }

    /**
     * 拖拽过程中
     */
    private onDrag(e: MouseEvent): void {
        if (!this.isDragging) return;
        
        e.preventDefault();
        
        const newX = e.clientX - this.dragOffset.x;
        const newY = e.clientY - this.dragOffset.y;
        
        // 确保不会拖拽到视窗外
        const maxX = window.innerWidth - this.dom.offsetWidth;
        const maxY = window.innerHeight - this.dom.offsetHeight;
        
        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));
        
        this.dom.style.left = `${clampedX}px`;
        this.dom.style.top = `${clampedY}px`;
    }

    /**
     * 结束拖拽
     */
    private endDrag(): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // 移除拖拽状态样式
        this.dom.classList.remove('cm-translation-dragging');
        this.dom.style.cursor = 'default';
    }

    /**
     * 处理语言变更
     */
    private handleLanguageChange(): void {
        // 语言变更后重新翻译，具体的语言限制逻辑在store中处理
        this.translate();
    }

    /**
     * 寻找替代的目标语言
     */
    private findAlternativeTargetLanguage(): void {
        const options = Array.from(this.targetLangSelector.options);
        for (const option of options) {
            if (option.value !== this.sourceLangSelector.value) {
                this.targetLangSelector.value = option.value;
                break;
            }
        }
    }

    /**
     * 交换源语言和目标语言
     */
    private swapLanguages(): void {
        const temp = this.sourceLangSelector.value;
        this.sourceLangSelector.value = this.targetLangSelector.value;
        this.targetLangSelector.value = temp;
        this.translate();
    }

    // ===== 翻译器管理 =====

    /**
     * 加载翻译器选项
     */
    private async loadTranslators(): Promise<boolean> {
        try {
            this.clearSelectOptions(this.translatorSelector);
            
            const translators = this.translationStore.translators;
            this.populateTranslatorOptions(translators);
            
            // 添加翻译器变更事件监听
            this.addEventListenerWithCleanup(this.translatorSelector, 'change', () => {
                this.handleTranslatorChange();
            });

            await this.updateLanguageSelectors();
            return true;
        } catch (error) {
            console.error('Failed to load translators:', error);
            this.loadDefaultTranslators();
            await this.updateLanguageSelectors();
            return false;
        }
    }

    /**
     * 填充翻译器选项
     */
    private populateTranslatorOptions(translators: string[]): void {
        translators.forEach((translator, index) => {
            const option = this.createElement('option') as HTMLOptionElement;
            option.value = translator;
            option.textContent = translator;
            option.selected = index === 0; // 选择第一个翻译器
            this.translatorSelector.appendChild(option);
        });
    }

    /**
     * 加载默认翻译器
     */
    private loadDefaultTranslators(): void {
        this.clearSelectOptions(this.translatorSelector);
        
        // 使用从后端获取的翻译器列表
        const translators = this.translationStore.translators;
        this.populateTranslatorOptions(translators);

        this.addEventListenerWithCleanup(this.translatorSelector, 'change', () => {
            this.handleTranslatorChange();
        });
    }

    /**
     * 处理翻译器选择变化
     */
    private async handleTranslatorChange(): Promise<void> {
        await this.updateLanguageSelectors();
        this.translate();
    }

    // ===== 语言选择器管理 =====

    /**
     * 更新语言选择器
     */
    private async updateLanguageSelectors(): Promise<void> {
        const currentTranslator = this.translatorSelector.value;
        
        // 保存当前选中的语言
        const currentSourceLang = this.sourceLangSelector.value || '';
        const currentTargetLang = this.targetLangSelector.value;

        // 清空选择器
        this.clearSelectOptions(this.sourceLangSelector);
        this.clearSelectOptions(this.targetLangSelector);

        // 直接使用预加载的语言映射
        const languageMap = this.translationStore.translatorLanguages[currentTranslator];

        if (!languageMap || Object.keys(languageMap).length === 0) {
            return;
        }

        // 添加语言选项
        Object.entries(languageMap).forEach(([code, langInfo]) => {
            this.addLanguageOption(code, langInfo);
        });

        // 恢复之前的语言选择
        this.restoreLanguageSelection(currentSourceLang, currentTargetLang);
    }

    /**
     * 清空选择器选项
     */
    private clearSelectOptions(selector: HTMLSelectElement): void {
        while (selector.firstChild) {
            selector.removeChild(selector.firstChild);
        }
    }

    /**
     * 添加语言选项到选择器
     */
    private addLanguageOption(code: string, langInfo: any): void {
        const displayName = langInfo.Name || langInfo.name || code;

        // 添加源语言选项
        const sourceOption = this.createElement('option') as HTMLOptionElement;
        sourceOption.value = code;
        sourceOption.textContent = displayName;
        this.sourceLangSelector.appendChild(sourceOption);

        // 添加目标语言选项
        const targetOption = this.createElement('option') as HTMLOptionElement;
        targetOption.value = code;
        targetOption.textContent = displayName;
        this.targetLangSelector.appendChild(targetOption);
    }

    /**
     * 恢复语言选择
     */
    private restoreLanguageSelection(sourceLang: string, targetLang: string): void {
        // 设置源语言
        if (sourceLang && this.hasLanguageOption(this.sourceLangSelector, sourceLang)) {
            this.sourceLangSelector.value = sourceLang;
        } else if (this.sourceLangSelector.options.length > 0) {
            this.sourceLangSelector.selectedIndex = 0;
        }

        // 设置目标语言
        if (targetLang && this.hasLanguageOption(this.targetLangSelector, targetLang)) {
            this.targetLangSelector.value = targetLang;
        } else if (this.targetLangSelector.options.length > 0) {
            this.targetLangSelector.selectedIndex = 0;
        }

        // 确保源语言和目标语言不同
        this.handleLanguageChange();
    }

    /**
     * 检查选择器是否有指定语言选项
     */
    private hasLanguageOption(selector: HTMLSelectElement, langCode: string): boolean {
        return Array.from(selector.options).some(option => option.value === langCode);
    }

    // ===== 翻译功能 =====


    /**
     * 执行翻译
     */
    private async translate(): Promise<void> {
        const sourceLang = this.sourceLangSelector.value;
        const targetLang = this.targetLangSelector.value;
        const translatorType = this.translatorSelector.value;

        this.showLoading();
        this.resultContainer.innerHTML = '';

        try {
            const result = await this.translationStore.translateText(
                this.sourceText,
                sourceLang,
                targetLang,
                translatorType
            );

            this.displayTranslationResult(result);
        } catch (err) {
            console.error('Translation failed:', err);
            this.displayError('Translation failed');
        } finally {
            this.hideLoading();
        }
    }

    // ===== UI 状态管理 =====
    
    /**
     * 显示加载状态
     */
    private showLoading(): void {
        this.loadingIndicator.style.display = 'block';
    }

    /**
     * 隐藏加载状态
     */
    private hideLoading(): void {
        this.loadingIndicator.style.display = 'none';
    }

    /**
     * 显示错误信息
     */
    private displayError(message: string): void {
        this.resultContainer.innerHTML = '';
        this.translatedText = '';
        
        const errorElement = this.createElement('div', 'cm-translation-error');
        errorElement.textContent = message;
        this.resultContainer.appendChild(errorElement);
    }

    // ===== 结果显示 =====

    /**
     * 显示翻译结果
     */
    private displayTranslationResult(result: any): void {
        this.resultContainer.innerHTML = '';

        const resultWrapper = this.createElement('div', 'cm-translation-result-wrapper');
        const translatedTextElem = this.createElement('div', 'cm-translation-target');

        if (result.error) {
            translatedTextElem.classList.add('cm-translation-error');
            translatedTextElem.textContent = result.error;
            this.translatedText = '';
        } else {
            this.translatedText = result.translatedText || '';
            translatedTextElem.textContent = this.translatedText;
        }

        // 添加复制按钮
        if (this.translatedText) {
            const copyButton = this.createCopyButton();
            resultWrapper.appendChild(copyButton);
        }

        resultWrapper.appendChild(translatedTextElem);
        this.resultContainer.appendChild(resultWrapper);
    }

    /**
     * 创建复制按钮
     */
    private createCopyButton(): HTMLButtonElement {
        const copyButton = this.createElement('button', 'cm-translation-copy-btn') as HTMLButtonElement;
        copyButton.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

        this.addEventListenerWithCleanup(copyButton, 'click', () => {
            this.copyToClipboard(copyButton);
        });

        return copyButton;
    }

    /**
     * 复制文本到剪贴板
     */
    private async copyToClipboard(button: HTMLButtonElement): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.translatedText);
            this.showCopySuccess(button);
        } catch (error) {
            console.error('Failed to copy text:', error);
        }
    }

    /**
     * 显示复制成功状态
     */
    private showCopySuccess(button: HTMLButtonElement): void {
        const originalHTML = button.innerHTML;
        button.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        button.classList.add('copied');

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('copied');
        }, 1500);
    }

    // ===== 生命周期管理 =====

    /**
     * 销毁组件时的清理工作
     */
    destroy(): void {
        this.cleanupEventListeners();
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