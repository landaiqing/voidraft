import {ExtensionFactory, ExtensionManager} from './ExtensionManager'
import {ExtensionID} from '@/../bindings/voidraft/internal/models/models'
import i18n from '@/i18n'

// 导入现有扩展的创建函数
import rainbowBracketsExtension from '../extensions/rainbowBracket/rainbowBracketsExtension'
import {createTextHighlighter} from '../extensions/textHighlight/textHighlightExtension'
import {createCodeBlastExtension} from '../extensions/codeblast'
import {color} from '../extensions/colorSelector'
import {hyperLink} from '../extensions/hyperlink'
import {minimap} from '../extensions/minimap'
import {vscodeSearch} from '../extensions/vscodeSearch'
import {createCodeBlockExtension} from '../extensions/codeblock'
import {foldingOnIndent} from '../extensions/fold/foldExtension'

/**
 * 彩虹括号扩展工厂
 */
export const rainbowBracketsFactory: ExtensionFactory = {
    create(config: any) {
        return rainbowBracketsExtension()
    },
    getDefaultConfig() {
        return {}
    },
    validateConfig(config: any) {
        return typeof config === 'object'
    }
}

/**
 * 文本高亮扩展工厂
 */
export const textHighlightFactory: ExtensionFactory = {
    create(config: any) {
        return createTextHighlighter('default')
    },
    getDefaultConfig() {
        return {
            highlightClass: 'hl'
        }
    },
    validateConfig(config: any) {
        return typeof config === 'object' &&
            (!config.highlightClass || typeof config.highlightClass === 'string')
    }
}

/**
 * 小地图扩展工厂
 */
export const minimapFactory: ExtensionFactory = {
    create(config: any) {
        const options = {
            displayText: config.displayText || 'characters',
            showOverlay: config.showOverlay || 'always',
            autohide: config.autohide || false
        }
        return minimap(options)
    },
    getDefaultConfig() {
        return {
            displayText: 'characters',
            showOverlay: 'always',
            autohide: false
        }
    },
    validateConfig(config: any) {
        return typeof config === 'object' &&
            (!config.displayText || typeof config.displayText === 'string') &&
            (!config.showOverlay || typeof config.showOverlay === 'string') &&
            (!config.autohide || typeof config.autohide === 'boolean')
    }
}

/**
 * 代码爆炸效果扩展工厂
 */
export const codeBlastFactory: ExtensionFactory = {
    create(config: any) {
        const options = {
            effect: config.effect || 1,
            shake: config.shake !== false,
            maxParticles: config.maxParticles || 300,
            shakeIntensity: config.shakeIntensity || 3
        }
        return createCodeBlastExtension(options)
    },
    getDefaultConfig() {
        return {
            effect: 1,
            shake: true,
            maxParticles: 300,
            shakeIntensity: 3
        }
    },
    validateConfig(config: any) {
        return typeof config === 'object' &&
            (!config.effect || [1, 2].includes(config.effect)) &&
            (!config.shake || typeof config.shake === 'boolean') &&
            (!config.maxParticles || typeof config.maxParticles === 'number') &&
            (!config.shakeIntensity || typeof config.shakeIntensity === 'number')
    }
}

/**
 * 超链接扩展工厂
 */
export const hyperlinkFactory: ExtensionFactory = {
    create(config: any) {
        return hyperLink
    },
    getDefaultConfig() {
        return {}
    },
    validateConfig(config: any) {
        return typeof config === 'object'
    }
}

/**
 * 颜色选择器扩展工厂
 */
export const colorSelectorFactory: ExtensionFactory = {
    create(config: any) {
        return color
    },
    getDefaultConfig() {
        return {}
    },
    validateConfig(config: any) {
        return typeof config === 'object'
    }
}

/**
 * 搜索扩展工厂
 */
export const searchFactory: ExtensionFactory = {
    create(config: any) {
        return vscodeSearch
    },
    getDefaultConfig() {
        return {}
    },
    validateConfig(config: any) {
        return typeof config === 'object'
    }
}

/**
 * 代码块扩展工厂
 */
export const codeBlockFactory: ExtensionFactory = {
    create(config: any) {
        const options = {
            showBackground: config.showBackground !== false,
            enableAutoDetection: config.enableAutoDetection !== false
        }
        return createCodeBlockExtension(options)
    },
    getDefaultConfig() {
        return {
            showBackground: true,
            enableAutoDetection: true
        }
    },
    validateConfig(config: any) {
        return typeof config === 'object' &&
            (!config.showBackground || typeof config.showBackground === 'boolean') &&
            (!config.enableAutoDetection || typeof config.enableAutoDetection === 'boolean')
    }
}

export const foldFactory: ExtensionFactory = {
    create(config: any) {
        return foldingOnIndent;
    },
    getDefaultConfig(): any {
        return {}
    },
    validateConfig(config: any): boolean {
        return typeof config === 'object'
    }
}

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

    // UI增强扩展
    [ExtensionID.ExtensionMinimap]: {
        factory: minimapFactory,
        displayNameKey: 'extensions.minimap.name',
        descriptionKey: 'extensions.minimap.description'
    },
    [ExtensionID.ExtensionCodeBlast]: {
        factory: codeBlastFactory,
        displayNameKey: 'extensions.codeBlast.name',
        descriptionKey: 'extensions.codeBlast.description'
    },

    // 工具扩展
    [ExtensionID.ExtensionSearch]: {
        factory: searchFactory,
        displayNameKey: 'extensions.search.name',
        descriptionKey: 'extensions.search.description'
    },
    [ExtensionID.ExtensionCodeBlock]: {
        factory: codeBlockFactory,
        displayNameKey: 'extensions.codeBlock.name',
        descriptionKey: 'extensions.codeBlock.description'
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
    }
}

/**
 * 注册所有扩展工厂到管理器
 * @param manager 扩展管理器实例
 */
export function registerAllExtensions(manager: ExtensionManager): void {
    Object.entries(EXTENSION_CONFIGS).forEach(([id, config]) => {
        manager.registerExtension(id as ExtensionID, config.factory)
    })
}

/**
 * 获取扩展工厂的显示名称
 * @param id 扩展ID
 * @returns 显示名称
 */
export function getExtensionDisplayName(id: ExtensionID): string {
    const config = EXTENSION_CONFIGS[id as ExtensionID]
    return config?.displayNameKey ? i18n.global.t(config.displayNameKey) : id
}

/**
 * 获取扩展工厂的描述
 * @param id 扩展ID
 * @returns 描述
 */
export function getExtensionDescription(id: ExtensionID): string {
    const config = EXTENSION_CONFIGS[id as ExtensionID]
    return config?.descriptionKey ? i18n.global.t(config.descriptionKey) : ''
}

/**
 * 获取所有可用扩展的ID列表
 * @returns 扩展ID数组
 */
export function getAllExtensionIds(): ExtensionID[] {
    return Object.keys(EXTENSION_CONFIGS) as ExtensionID[]
} 