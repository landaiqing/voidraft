/**
 * 语言检测模块
 */

export {
    createLanguageDetection,
    detectLanguage,
    detectLanguages,
    type LanguageDetectionResult,
    type LanguageDetectionConfig
} from './autodetect';

export { levenshteinDistance } from './levenshtein';
export type { SupportedLanguage } from '../types';