/**
 * 自动语言检测
 * 基于内容变化自动检测和更新代码块语言
 */

import { EditorState, Annotation } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { blockState, getActiveNoteBlock } from '../state';
import { levenshteinDistance } from './levenshtein';
import { detectLanguageHeuristic, LanguageDetectionResult } from './heuristics';
import { LANGUAGES } from '../lang-parser/languages';
import { SupportedLanguage, Block } from '../types';

/**
 * 语言检测配置
 */
interface LanguageDetectionConfig {
    /** 最小内容长度阈值 */
    minContentLength: number;
    /** 变化阈值比例 */
    changeThreshold: number;
    /** 检测置信度阈值 */
    confidenceThreshold: number;
    /** 空闲检测延迟 (ms) */
    idleDelay: number;
    /** 默认语言 */
    defaultLanguage: SupportedLanguage;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: LanguageDetectionConfig = {
    minContentLength: 8,
    changeThreshold: 0.1,
    confidenceThreshold: 0.3,
    idleDelay: 1000,
    defaultLanguage: 'text',
};

/**
 * 语言标记映射
 * 将检测结果映射到我们的语言标记
 */
const DETECTION_TO_TOKEN = Object.fromEntries(
    LANGUAGES.map(l => [l.token, l.token])
);

/**
 * 兼容性函数
 */
function requestIdleCallbackCompat(cb: () => void): number {
    if (typeof window !== 'undefined' && window.requestIdleCallback) {
        return window.requestIdleCallback(cb);
    } else {
        return setTimeout(cb, 0) as any;
    }
}

function cancelIdleCallbackCompat(id: number): void {
    if (typeof window !== 'undefined' && window.cancelIdleCallback) {
        window.cancelIdleCallback(id);
    } else {
        clearTimeout(id);
    }
}

/**
 * 语言更改注解
 */
const languageChangeAnnotation = Annotation.define<boolean>();

/**
 * 语言更改命令
 * 简化版本，直接更新块的语言标记
 */
function changeLanguageTo(
    state: EditorState,
    dispatch: (tr: any) => void,
    block: Block,
    newLanguage: SupportedLanguage,
    isAuto: boolean
): void {
    // 构建新的分隔符文本
    const autoSuffix = isAuto ? '-a' : '';
    const newDelimiter = `\n∞∞∞${newLanguage}${autoSuffix}\n`;
    
    // 创建事务来替换分隔符
    const transaction = state.update({
        changes: {
            from: block.delimiter.from,
            to: block.delimiter.to,
            insert: newDelimiter,
        },
        annotations: [
            languageChangeAnnotation.of(true)
        ]
    });
    
    dispatch(transaction);
}



/**
 * 创建语言检测插件
 */
export function createLanguageDetection(
    config: Partial<LanguageDetectionConfig> = {}
): ViewPlugin<any> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const previousBlockContent: Record<number, string> = {};
    let idleCallbackId: number | null = null;

    return ViewPlugin.fromClass(
        class LanguageDetectionPlugin {
            constructor(public view: EditorView) {}

            update(update: any) {
                if (update.docChanged) {
                    // 取消之前的检测
                    if (idleCallbackId !== null) {
                        cancelIdleCallbackCompat(idleCallbackId);
                        idleCallbackId = null;
                    }

                    // 安排新的检测
                    idleCallbackId = requestIdleCallbackCompat(() => {
                        idleCallbackId = null;
                        this.performLanguageDetection(update);
                    });
                }
            }

            private performLanguageDetection(update: any) {
                const range = update.state.selection.asSingle().ranges[0];
                const blocks = update.state.field(blockState);
                
                let block: Block | null = null;
                let blockIndex: number | null = null;

                // 找到当前块
                for (let i = 0; i < blocks.length; i++) {
                    if (blocks[i].content.from <= range.from && blocks[i].content.to >= range.from) {
                        block = blocks[i];
                        blockIndex = i;
                        break;
                    }
                }

                if (block === null || blockIndex === null) {
                    return;
                }


                // 如果不是自动检测模式，清除缓存并返回
                if (!block.language.auto) {
                    delete previousBlockContent[blockIndex];
                    return;
                }

                const content = update.state.doc.sliceString(block.content.from, block.content.to);

                // 如果内容为空，重置为默认语言
                if (content === "") {
                    if (block.language.name !== finalConfig.defaultLanguage) {
                        changeLanguageTo(
                            update.state,
                            this.view.dispatch,
                            block,
                            finalConfig.defaultLanguage,
                            true
                        );
                    }
                    delete previousBlockContent[blockIndex];
                    return;
                }

                // 内容太短，跳过检测
                if (content.length <= finalConfig.minContentLength) {
                    return;
                }

                // 检查内容是否有显著变化
                const threshold = content.length * finalConfig.changeThreshold;
                const previousContent = previousBlockContent[blockIndex];
                
                if (!previousContent) {
                    // 执行语言检测
                    this.detectAndUpdateLanguage(content, block, blockIndex, update.state);
                    previousBlockContent[blockIndex] = content;
                } else {
                    const distance = levenshteinDistance(previousContent, content);

                    if (distance >= threshold) {
                        // 执行语言检测
                        this.detectAndUpdateLanguage(content, block, blockIndex, update.state);
                        previousBlockContent[blockIndex] = content;
                    }
                }
            }

            private detectAndUpdateLanguage(
                content: string,
                block: any,
                blockIndex: number,
                state: EditorState
            ) {

                // 使用启发式检测
                const detectionResult = detectLanguageHeuristic(content);

                // 检查置信度和语言变化
                if (detectionResult.confidence >= finalConfig.confidenceThreshold &&
                    detectionResult.language !== block.language.name &&
                    DETECTION_TO_TOKEN[detectionResult.language]) {
                    

                    // 验证内容未显著变化
                    const currentContent = state.doc.sliceString(block.content.from, block.content.to);
                    const threshold = currentContent.length * finalConfig.changeThreshold;
                    const contentDistance = levenshteinDistance(content, currentContent);
                    

                    if (contentDistance <= threshold) {
                        // 内容未显著变化，安全更新语言
                        changeLanguageTo(
                            state,
                            this.view.dispatch,
                            block,
                            detectionResult.language,
                            true
                        );
                    }
                }
            }

            destroy() {
                if (idleCallbackId !== null) {
                    cancelIdleCallbackCompat(idleCallbackId);
                }
            }
        }
    );
}

/**
 * 手动检测语言
 */
export function detectLanguage(content: string): LanguageDetectionResult {
    return detectLanguageHeuristic(content);
}

/**
 * 批量检测多个内容块的语言
 */
export function detectLanguages(contents: string[]): LanguageDetectionResult[] {
    return contents.map(content => detectLanguageHeuristic(content));
} 