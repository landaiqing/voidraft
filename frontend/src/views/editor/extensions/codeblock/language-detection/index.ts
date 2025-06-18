/**
 * 语言检测模块入口
 * 导出所有语言检测相关的功能
 */

// 主要检测功能
export {
    createLanguageDetection,
    detectLanguage,
    detectLanguages
} from './autodetect';

// 启发式检测
export {
    detectLanguageHeuristic,
    getSupportedDetectionLanguages,
    type LanguageDetectionResult
} from './heuristics';

// 工具函数
export {
    levenshteinDistance
} from './levenshtein';

// 重新导出类型
export type { SupportedLanguage } from '../types'; 