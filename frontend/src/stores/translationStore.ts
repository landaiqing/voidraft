import {defineStore} from 'pinia';
import {ref} from 'vue';
import {TranslationService} from '@/../bindings/voidraft/internal/services';
/**
 * 翻译结果接口
 */
export interface TranslationResult {
    translatedText: string;
    error?: string;
}

/**
 * 语言信息接口
 */
export interface LanguageInfo {
    Code: string; // 语言代码
    Name: string; // 语言名称
}
/**
 * 翻译相关的错误消息
 */
export const TRANSLATION_ERRORS = {
    NO_TEXT: 'no text to translate',
    TRANSLATION_FAILED: 'translation failed',
} as const;

export const useTranslationStore = defineStore('translation', () => {
    // 基础状态
    const translators = ref<string[]>([]);
    const isTranslating = ref<boolean>(false);
    // 语言映射
    const translatorLanguages = ref<Record<string, Record<string, LanguageInfo>>>({});

    /**
     * 加载可用翻译器列表并预先加载所有语言映射
     */
    const loadTranslators = async (): Promise<void> => {
        try {
            translators.value = await TranslationService.GetTranslators();

            const loadPromises = translators.value.map(async (translatorType) => {
                try {
                    const languages = await TranslationService.GetTranslatorLanguages(translatorType as any);
                    if (languages) {
                        translatorLanguages.value[translatorType] = languages;
                    }
                } catch (err) {
                    console.error(`Failed to preload languages for ${translatorType}:`, err);
                }
            });
            
            // 等待所有语言映射加载完成
            await Promise.all(loadPromises);
        } catch (err) {
            console.error('Failed to load available translators:', err);
        }
    };

    /**
     * 加载指定翻译器的语言列表
     */
    const loadTranslatorLanguages = async (translatorType: string): Promise<void> => {
        try {
            const languages = await TranslationService.GetTranslatorLanguages(translatorType as any);
            if (languages) {
                translatorLanguages.value[translatorType] = languages;
            }
        } catch (err) {
            console.error(`Failed to load languages for ${translatorType}:`, err);
        }
    };

    /**
     * 翻译文本
     */
    const translateText = async (
        text: string,
        sourceLang: string,
        targetLang: string,
        translatorType: string
    ): Promise<TranslationResult> => {

        if (!text.trim()) {
            return {
                translatedText: '',
                error: TRANSLATION_ERRORS.NO_TEXT
            };
        }
        
        // 特殊处理有道翻译器：有道翻译器允许源语言和目标语言都是auto
        const isYoudaoTranslator = translatorType === 'youdao';
        const bothAuto = sourceLang === 'auto' && targetLang === 'auto';

        if (sourceLang === targetLang && !(isYoudaoTranslator && bothAuto)) {
            return {
                translatedText: text
            };
        }

        isTranslating.value = true;

        try {
            const translatedText = await TranslationService.TranslateWith(
                text,
                sourceLang,
                targetLang,
                translatorType
            );

            return {
                translatedText
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : TRANSLATION_ERRORS.TRANSLATION_FAILED;

            return {
                translatedText: '',
                error: errorMessage
            };
        } finally {
            isTranslating.value = false;
        }
    };



    return {
        // 状态
        translators,
        isTranslating,
        translatorLanguages,

        // 方法
        loadTranslators,
        loadTranslatorLanguages,
        translateText,
    };
});