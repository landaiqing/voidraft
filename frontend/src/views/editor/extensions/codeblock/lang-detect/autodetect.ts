/**
 * 基于 Web Worker 的语言自动检测
 */

import { EditorState, Annotation } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { redoDepth } from '@codemirror/commands';
import { blockState, getActiveNoteBlock } from '../state';
import { levenshteinDistance } from './levenshtein';
import { LANGUAGES } from '../lang-parser/languages';
import { SupportedLanguage, Block } from '../types';
import { changeLanguageTo } from '../commands';

// ===== 类型定义 =====

/**
 * 语言检测配置选项
 */
export interface LanguageDetectionConfig {
    minContentLength?: number;
    confidenceThreshold?: number;
    idleDelay?: number;
    defaultLanguage?: SupportedLanguage;
}

/**
 * 语言检测结果
 */
export interface LanguageDetectionResult {
    language: SupportedLanguage;
    confidence: number;
}

/**
 * Worker 消息接口
 */
interface WorkerMessage {
    content: string;
    idx: number;
}

/**
 * Worker 响应接口
 */
interface WorkerResponse {
    language: string;
    confidence: number;
    idx: number;
}

// ===== 常量配置 =====

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
    minContentLength: 20,
    confidenceThreshold: 0.15,
    idleDelay: 1000,
    defaultLanguage: 'text' as SupportedLanguage,
};

/**
 * 创建检测ID到语言token的映射
 */
function createDetectionMap(): Map<string, SupportedLanguage> {
    const map = new Map<string, SupportedLanguage>();
    LANGUAGES.forEach(lang => {
        if (lang.detectIds) {
            lang.detectIds.forEach(detectId => {
                map.set(detectId, lang.token);
            });
        }
    });
    return map;
}

/**
 * 检测ID到语言token的映射表
 */
const DETECTION_MAP = createDetectionMap();

// ===== 工具函数 =====

/**
 * 兼容性函数：requestIdleCallback
 */
function requestIdleCallbackCompat(callback: () => void): number {
    if (typeof window !== 'undefined' && window.requestIdleCallback) {
        return window.requestIdleCallback(callback);
    }
    return setTimeout(callback, 0) as any;
}

/**
 * 兼容性函数：cancelIdleCallback
 */
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

// ===== Web Worker 管理器 =====

/**
 * 语言检测 Worker 管理器
 * 负责 Worker 的生命周期管理和消息通信
 */
class LanguageDetectionWorker {
    private worker: Worker | null = null;
    private pendingRequests = new Map<number, {
        resolve: (result: LanguageDetectionResult) => void;
        reject: (error: Error) => void;
    }>();
    private requestId = 0;

    constructor() {
        this.initWorker();
    }

    /**
     * 初始化 Worker
     */
    private initWorker(): void {
        try {
            this.worker = new Worker('/langdetect-worker.js');
            this.worker.onmessage = (event) => {
                const response: WorkerResponse = event.data;
                const request = this.pendingRequests.get(response.idx);
                if (request) {
                    this.pendingRequests.delete(response.idx);
                    if (response.language) {
                        request.resolve({
                            language: response.language as SupportedLanguage,
                            confidence: response.confidence
                        });
                    } else {
                        request.reject(new Error('No detection result'));
                    }
                }
            };
            this.worker.onerror = () => {
                this.pendingRequests.forEach(request => request.reject(new Error('Worker error')));
                this.pendingRequests.clear();
            };
        } catch (error) {
            console.error('Failed to initialize worker:', error);
        }
    }

    /**
     * 检测语言
     */
    async detectLanguage(content: string): Promise<LanguageDetectionResult> {
        if (!this.worker) {
            throw new Error('Worker not initialized');
        }

        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, { resolve, reject });

            this.worker!.postMessage({ content, idx: id } as WorkerMessage);

            // 5秒超时
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Detection timeout'));
                }
            }, 5000);
        });
    }

    /**
     * 销毁 Worker
     */
    destroy(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingRequests.clear();
    }
}

// ===== 语言检测插件 =====

/**
 * 创建语言检测插件
 */
export function createLanguageDetection(config: LanguageDetectionConfig = {}): ViewPlugin<any> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const contentCache = new Map<number, string>();
    let idleCallbackId: number | null = null;
    let worker: LanguageDetectionWorker | null = null;

    return ViewPlugin.fromClass(
        class LanguageDetectionPlugin {
            constructor(public view: EditorView) {
                worker = new LanguageDetectionWorker();
            }

            update(update: any) {
                if (update.docChanged && !update.transactions.some((tr: any) => 
                    tr.annotation(languageChangeAnnotation))) {
                    
                    if (idleCallbackId !== null) {
                        cancelIdleCallbackCompat(idleCallbackId);
                    }
                    
                    idleCallbackId = requestIdleCallbackCompat(() => {
                        this.performDetection(update.state);
                    });
                }
            }

            private performDetection(state: EditorState): void {
                const block = getActiveNoteBlock(state);
                
                if (!block || !block.language.auto) return;

                const blocks = state.field(blockState);
                const blockIndex = blocks.indexOf(block);
                const content = state.doc.sliceString(block.content.from, block.content.to);

                // 内容为空时重置为默认语言
                if (content === "" && redoDepth(state) === 0) {
                    if (block.language.name !== finalConfig.defaultLanguage) {
                        changeLanguageTo(state, this.view.dispatch, block, finalConfig.defaultLanguage, true);
                    }
                    contentCache.delete(blockIndex);
                    return;
                }

                // 内容太短则跳过
                if (content.length <= finalConfig.minContentLength) return;

                // 检查内容变化
                const cachedContent = contentCache.get(blockIndex);
                if (cachedContent && levenshteinDistance(cachedContent, content) < content.length * 0.1) {
                    return;
                }

                this.detectAndUpdate(content, block, blockIndex, state);
            }

            private async detectAndUpdate(content: string, block: Block, blockIndex: number, state: EditorState): Promise<void> {
                if (!worker) return;

                try {
                    const result = await worker.detectLanguage(content);
                    
                    // 使用检测映射表将检测结果转换为我们支持的语言
                    const mappedLanguage = DETECTION_MAP.get(result.language);
                    
                    if (mappedLanguage &&
                        result.confidence >= finalConfig.confidenceThreshold &&
                        mappedLanguage !== block.language.name) {
                        
                        // 只有在用户没有撤销操作时才更改语言
                        if (redoDepth(state) === 0) {
                            changeLanguageTo(state, this.view.dispatch, block, mappedLanguage, true);
                        }
                    }

                    contentCache.set(blockIndex, content);
                } catch (error) {
                    console.warn('Language detection failed:', error);
                }
            }

            destroy() {
                if (idleCallbackId !== null) {
                    cancelIdleCallbackCompat(idleCallbackId);
                }
                if (worker) {
                    worker.destroy();
                    worker = null;
                }
                contentCache.clear();
            }
        }
    );
}

// ===== 公共 API =====

/**
 * 手动检测单个内容的语言
 */
export async function detectLanguage(content: string): Promise<LanguageDetectionResult> {
    const worker = new LanguageDetectionWorker();
    try {
        return await worker.detectLanguage(content);
    } finally {
        worker.destroy();
    }
}

/**
 * 批量检测多个内容的语言
 */
export async function detectLanguages(contents: string[]): Promise<LanguageDetectionResult[]> {
    const worker = new LanguageDetectionWorker();
    try {
        return await Promise.all(contents.map(content => worker.detectLanguage(content)));
    } finally {
        worker.destroy();
    }
} 