import {ExtensionFactory, ExtensionManager} from './ExtensionManager';
import {ExtensionID} from '@/../bindings/voidraft/internal/models/models';
import i18n from '@/i18n';

// 导入现有扩展的创建函数
import rainbowBracketsExtension from '../extensions/rainbowBracket/rainbowBracketsExtension';
import {createTextHighlighter} from '../extensions/textHighlight/textHighlightExtension';

import {color} from '../extensions/colorSelector';
import {hyperLink} from '../extensions/hyperlink';
import {minimap} from '../extensions/minimap';
import {vscodeSearch} from '../extensions/vscodeSearch';
import {createCheckboxExtension} from '../extensions/checkbox';
import {createTranslatorExtension} from '../extensions/translator';

import {foldingOnIndent} from '../extensions/fold/foldExtension';

/**
 * 彩虹括号扩展工厂
 */
export const rainbowBracketsFactory: ExtensionFactory = {
    create(_config: any) {
        return rainbowBracketsExtension();
    },
    getDefaultConfig() {
        return {};
    },
    validateConfig(config: any) {
        return typeof config === 'object';
    }
};

/**
 * 文本高亮扩展工厂
 */
export const textHighlightFactory: ExtensionFactory = {
    create(config: any) {
        return createTextHighlighter({
            backgroundColor: config.backgroundColor || '#FFD700',
            opacity: config.opacity || 0.3
        });
    },
    getDefaultConfig() {
        return {
            backgroundColor: '#FFD700', // 金黄色
            opacity: 0.3 // 透明度
        };
    },
    validateConfig(config: any) {
        return typeof config === 'object' &&
            (!config.backgroundColor || typeof config.backgroundColor === 'string') &&
            (!config.opacity || (typeof config.opacity === 'number' && config.opacity >= 0 && config.opacity <= 1));
    }
};

/**
 * 小地图扩展工厂
 */
export const minimapFactory: ExtensionFactory = {
    create(config: any) {
        const options = {
            displayText: config.displayText || 'characters',
            showOverlay: config.showOverlay || 'always',
            autohide: config.autohide || false
        };
        return minimap(options);
    },
    getDefaultConfig() {
        return {
            displayText: 'characters',
            showOverlay: 'always',
            autohide: false
        };
    },
    validateConfig(config: any) {
        return typeof config === 'object' &&
            (!config.displayText || typeof config.displayText === 'string') &&
            (!config.showOverlay || typeof config.showOverlay === 'string') &&
            (!config.autohide || typeof config.autohide === 'boolean');
    }
};

/**
 * 超链接扩展工厂
 */
export const hyperlinkFactory: ExtensionFactory = {
    create(_config: any) {
        return hyperLink;
    },
    getDefaultConfig() {
        return {};
    },
    validateConfig(config: any) {
        return typeof config === 'object';
    }
};

/**
 * 颜色选择器扩展工厂
 */
export const colorSelectorFactory: ExtensionFactory = {
    create(_config: any) {
        return color;
    },
    getDefaultConfig() {
        return {};
    },
    validateConfig(config: any) {
        return typeof config === 'object';
    }
};

/**
 * 搜索扩展工厂
 */
export const searchFactory: ExtensionFactory = {
    create(_config: any) {
        return vscodeSearch;
    },
    getDefaultConfig() {
        return {};
    },
    validateConfig(config: any) {
        return typeof config === 'object';
    }
};

export const foldFactory: ExtensionFactory = {
    create(_config: any) {
        return foldingOnIndent;
    },
    getDefaultConfig(): any {
        return {};
    },
    validateConfig(config: any): boolean {
        return typeof config === 'object';
    }
};

/**
 * 选择框扩展工厂
 */
export const checkboxFactory: ExtensionFactory = {
    create(_config: any) {
        return createCheckboxExtension();
    },
    getDefaultConfig() {
        return {};
    },
    validateConfig(config: any) {
        return typeof config === 'object';
    }
};

/**
 * 翻译扩展工厂
 */
export const translatorFactory: ExtensionFactory = {
    create(config: any) {
        return createTranslatorExtension({
            minSelectionLength: config.minSelectionLength || 2,
            maxTranslationLength: config.maxTranslationLength || 5000,
        });
    },
    getDefaultConfig() {
        return {
            minSelectionLength: 2,
            maxTranslationLength: 5000,
        };
    },
    validateConfig(config: any) {
        return typeof config === 'object';
    }
};

/**
 * 所有扩展的统一配置
 * 排除$zero值以避免TypeScript类型错误
 */
const EXTENSION_CONFIGS = {

    // 编辑增强扩展
    [ExtensionID.ExtensionRainbowBrackets]: {
        factory: rainbowBracketsFactory,
        displayNameKey: 'extensions.rainbowBrackets.name',
        descriptionKey: 'extensions.rainbowBrackets.description'
    },
    [ExtensionID.ExtensionHyperlink]: {
        factory: hyperlinkFactory,
        displayNameKey: 'extensions.hyperlink.name',
        descriptionKey: 'extensions.hyperlink.description'
    },
    [ExtensionID.ExtensionColorSelector]: {
        factory: colorSelectorFactory,
        displayNameKey: 'extensions.colorSelector.name',
        descriptionKey: 'extensions.colorSelector.description'
    },
    [ExtensionID.ExtensionTranslator]: {
        factory: translatorFactory,
        displayNameKey: 'extensions.translator.name',
        descriptionKey: 'extensions.translator.description'
    },

    // UI增强扩展
    [ExtensionID.ExtensionMinimap]: {
        factory: minimapFactory,
        displayNameKey: 'extensions.minimap.name',
        descriptionKey: 'extensions.minimap.description'
    },

    // 工具扩展
    [ExtensionID.ExtensionSearch]: {
        factory: searchFactory,
        displayNameKey: 'extensions.search.name',
        descriptionKey: 'extensions.search.description'
    },

    [ExtensionID.ExtensionFold]: {
        factory: foldFactory,
        displayNameKey: 'extensions.fold.name',
        descriptionKey: 'extensions.fold.description'
    },
    [ExtensionID.ExtensionTextHighlight]: {
        factory: textHighlightFactory,
        displayNameKey: 'extensions.textHighlight.name',
        descriptionKey: 'extensions.textHighlight.description'
    },
    [ExtensionID.ExtensionCheckbox]: {
        factory: checkboxFactory,
        displayNameKey: 'extensions.checkbox.name',
        descriptionKey: 'extensions.checkbox.description'
    }
};

/**
 * 注册所有扩展工厂到管理器
 * @param manager 扩展管理器实例
 */
export function registerAllExtensions(manager: ExtensionManager): void {
    Object.entries(EXTENSION_CONFIGS).forEach(([id, config]) => {
        manager.registerExtension(id as ExtensionID, config.factory);
    });
}

/**
 * 获取扩展工厂的显示名称
 * @param id 扩展ID
 * @returns 显示名称
 */
export function getExtensionDisplayName(id: ExtensionID): string {
    const config = EXTENSION_CONFIGS[id as ExtensionID];
    return config?.displayNameKey ? i18n.global.t(config.displayNameKey) : id;
}

/**
 * 获取扩展工厂的描述
 * @param id 扩展ID
 * @returns 描述
 */
export function getExtensionDescription(id: ExtensionID): string {
    const config = EXTENSION_CONFIGS[id as ExtensionID];
    return config?.descriptionKey ? i18n.global.t(config.descriptionKey) : '';
}

/**
 * 获取扩展工厂实例
 * @param id 扩展ID
 * @returns 扩展工厂实例
 */
export function getExtensionFactory(id: ExtensionID): ExtensionFactory | undefined {
    return EXTENSION_CONFIGS[id as ExtensionID]?.factory;
}

/**
 * 获取扩展的默认配置
 * @param id 扩展ID
 * @returns 默认配置对象
 */
export function getExtensionDefaultConfig(id: ExtensionID): any {
    const factory = getExtensionFactory(id);
    return factory?.getDefaultConfig() || {};
}

/**
 * 检查扩展是否有配置项
 * @param id 扩展ID
 * @returns 是否有配置项
 */
export function hasExtensionConfig(id: ExtensionID): boolean {
    const defaultConfig = getExtensionDefaultConfig(id);
    return Object.keys(defaultConfig).length > 0;
}

/**
 * 获取所有可用扩展的ID列表
 * @returns 扩展ID数组
 */
export function getAllExtensionIds(): ExtensionID[] {
    return Object.keys(EXTENSION_CONFIGS) as ExtensionID[];
} 