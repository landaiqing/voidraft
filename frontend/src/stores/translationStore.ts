import {defineStore} from 'pinia';
import {computed, ref, watch} from 'vue';
import {TranslationService} from '@/../bindings/voidraft/internal/services';
import {franc} from 'franc-min';

export interface TranslationResult {
    sourceText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    translatorType: string;
    error?: string;
}

/**
 * ISO 639-3 到 ISO 639-1/2 语言代码的映射
 * franc-min 返回的是 ISO 639-3 代码，需要转换为翻译API常用的 ISO 639-1/2 代码
 */
const ISO_LANGUAGE_MAP: Record<string, string> = {
    // 常见语言
    'cmn': 'zh',    // 中文 (Mandarin Chinese)
    'eng': 'en',    // 英文 (English)
    'jpn': 'ja',    // 日语 (Japanese)
    'kor': 'ko',    // 韩语 (Korean)
    'fra': 'fr',    // 法语 (French)
    'deu': 'de',    // 德语 (German)
    'spa': 'es',    // 西班牙语 (Spanish)
    'rus': 'ru',    // 俄语 (Russian)
    'ita': 'it',    // 意大利语 (Italian)
    'nld': 'nl',    // 荷兰语 (Dutch)
    'por': 'pt',    // 葡萄牙语 (Portuguese)
    'vie': 'vi',    // 越南语 (Vietnamese)
    'arb': 'ar',    // 阿拉伯语 (Arabic)
    'hin': 'hi',    // 印地语 (Hindi)
    'ben': 'bn',    // 孟加拉语 (Bengali)
    'tha': 'th',    // 泰语 (Thai)
    'tur': 'tr',    // 土耳其语 (Turkish)
    'heb': 'he',    // 希伯来语 (Hebrew)
    'pol': 'pl',    // 波兰语 (Polish)
    'swe': 'sv',    // 瑞典语 (Swedish)
    'fin': 'fi',    // 芬兰语 (Finnish)
    'dan': 'da',    // 丹麦语 (Danish)
    'ron': 'ro',    // 罗马尼亚语 (Romanian)
    'hun': 'hu',    // 匈牙利语 (Hungarian)
    'ces': 'cs',    // 捷克语 (Czech)
    'ell': 'el',    // 希腊语 (Greek)
    'bul': 'bg',    // 保加利亚语 (Bulgarian)
    'cat': 'ca',    // 加泰罗尼亚语 (Catalan)
    'ukr': 'uk',    // 乌克兰语 (Ukrainian)
    'hrv': 'hr',    // 克罗地亚语 (Croatian)
    'ind': 'id',    // 印尼语 (Indonesian)
    'mal': 'ms',    // 马来语 (Malay)
    'nob': 'no',    // 挪威语 (Norwegian)
    'lat': 'la',    // 拉丁语 (Latin)
    'lit': 'lt',    // 立陶宛语 (Lithuanian)
    'slk': 'sk',    // 斯洛伐克语 (Slovak)
    'slv': 'sl',    // 斯洛文尼亚语 (Slovenian)
    'srp': 'sr',    // 塞尔维亚语 (Serbian)
    'est': 'et',    // 爱沙尼亚语 (Estonian)
    'lav': 'lv',    // 拉脱维亚语 (Latvian)
    'fil': 'tl',    // 菲律宾语/他加禄语 (Filipino/Tagalog)

    // 未知/不确定
    'und': 'auto'   // 未知语言
};

// 语言代码的通用映射关系，适用于大部分翻译器
const COMMON_LANGUAGE_ALIASES: Record<string, string[]> = {
    'zh': ['zh-CN', 'zh-TW', 'zh-Hans', 'zh-Hant', 'chinese', 'zhong'],
    'en': ['en-US', 'en-GB', 'english', 'eng'],
    'ja': ['jp', 'jpn', 'japanese'],
    'ko': ['kr', 'kor', 'korean'],
    'fr': ['fra', 'french'],
    'de': ['deu', 'german', 'ger'],
    'es': ['spa', 'spanish', 'esp'],
    'ru': ['rus', 'russian'],
    'pt': ['por', 'portuguese'],
    'it': ['ita', 'italian'],
    'nl': ['nld', 'dutch'],
    'ar': ['ara', 'arabic'],
    'hi': ['hin', 'hindi'],
    'th': ['tha', 'thai'],
    'tr': ['tur', 'turkish'],
    'vi': ['vie', 'vietnamese'],
    'id': ['ind', 'indonesian'],
    'ms': ['mal', 'malay'],
    'fi': ['fin', 'finnish'],
};

/**
 * 翻译存储
 */
export const useTranslationStore = defineStore('translation', () => {
    // 状态
    const availableTranslators = ref<string[]>([]);
    const isTranslating = ref(false);
    const lastResult = ref<TranslationResult | null>(null);
    const error = ref<string | null>(null);
    // 语言列表 - 将类型设置为any以避免类型错误
    const languageMaps = ref<Record<string, Record<string, any>>>({});
    
    // 语言使用频率计数 - 使用pinia持久化
    const languageUsageCount = ref<Record<string, number>>({});
    // 最近使用的翻译语言 - 最多记录10个
    const recentLanguages = ref<string[]>([]);

    // 默认配置
    // 注意：确保默认值在初始化和持久化后正确设置
    const defaultTargetLang = ref('zh');
    const defaultTranslator = ref('bing');
    // 检测到的源语言，初始为空字符串表示尚未检测
    const detectedSourceLang = ref('');

    // 计算属性
    const hasTranslators = computed(() => availableTranslators.value.length > 0);
    const currentLanguageMap = computed(() => {
        return languageMaps.value[defaultTranslator.value] || {};
    });
    
    // 监听默认语言变更，确保目标语言在当前翻译器支持的范围内
    watch([defaultTranslator], () => {
        // 当切换翻译器时，验证默认目标语言是否支持
        if (Object.keys(languageMaps.value).length > 0) {
            const validatedLang = validateLanguage(defaultTargetLang.value, defaultTranslator.value);
            if (validatedLang !== defaultTargetLang.value) {
                console.log(`目标语言 ${defaultTargetLang.value} 不受支持，已切换到 ${validatedLang}`);
                defaultTargetLang.value = validatedLang;
            }
        }
    });

    /**
     * 加载可用翻译器
     */
    const loadAvailableTranslators = async (): Promise<void> => {
        try {
            const translators = await TranslationService.GetAvailableTranslators();
            availableTranslators.value = translators;
            
            // 如果默认翻译器不在可用列表中，则使用第一个可用的翻译器
            if (translators.length > 0 && !translators.includes(defaultTranslator.value)) {
                defaultTranslator.value = translators[0];
            }
            
            // 加载所有翻译器的语言列表
            await Promise.all(translators.map(loadTranslatorLanguages));
            
            // 在加载完所有语言列表后，确保默认目标语言有效
            if (defaultTargetLang.value) {
                const validatedLang = validateLanguage(defaultTargetLang.value, defaultTranslator.value);
                if (validatedLang !== defaultTargetLang.value) {
                    console.log(`目标语言 ${defaultTargetLang.value} 不受支持，已切换到 ${validatedLang}`);
                    defaultTargetLang.value = validatedLang;
                }
            }
        } catch (err) {
            error.value = 'no available translators';
        }
    };

    /**
     * 加载指定翻译器的语言列表
     * @param translatorType 翻译器类型
     */
    const loadTranslatorLanguages = async (translatorType: string): Promise<void> => {
        try {
            const languages = await TranslationService.GetTranslatorLanguages(translatorType as any);
            
            if (languages) {
                languageMaps.value[translatorType] = languages;
            }
        } catch (err) {
            console.error(`Failed to load languages for ${translatorType}:`, err);
        }
    };

    /**
     * 检测文本语言
     * @param text 待检测的文本
     * @returns 检测到的语言代码，如未检测到则返回空字符串
     */
    const detectLanguage = (text: string): string => {
        if (!text || text.trim().length < 10) {
            return '';
        }
        
        try {
            // franc返回ISO 639-3代码
            const detectedIso639_3 = franc(text);
            
            // 如果是未知语言，返回空字符串
            if (detectedIso639_3 === 'und') {
                return '';
            }
            
            // 转换为常用语言代码
            return ISO_LANGUAGE_MAP[detectedIso639_3] || '';
        } catch (err) {
            console.error('语言检测失败:', err);
            return '';
        }
    };

    /**
     * 在翻译器语言列表中查找相似的语言代码
     * @param langCode 待查找的语言代码
     * @param translatorType 翻译器类型
     * @returns 找到的语言代码或空字符串
     */
    const findSimilarLanguage = (langCode: string, translatorType: string): string => {
        if (!langCode) return '';
        
        const languageMap = languageMaps.value[translatorType] || {};
        const langCodeLower = langCode.toLowerCase();
        
        // 1. 尝试精确匹配
        if (languageMap[langCode]) {
            return langCode;
        }
        
        // 2. 检查通用别名映射
        const possibleAliases = Object.entries(COMMON_LANGUAGE_ALIASES).find(
            ([code, aliases]) => code === langCodeLower || aliases.includes(langCodeLower)
        );
        
        if (possibleAliases) {
            // 检查主代码是否可用
            const [mainCode, aliases] = possibleAliases;
            if (languageMap[mainCode]) {
                return mainCode;
            }
            
            // 检查别名是否可用
            for (const alias of aliases) {
                if (languageMap[alias]) {
                    return alias;
                }
            }
        }
        
        // 3. 尝试正则表达式匹配
        // 创建一个基于语言代码的正则表达式：例如 'en' 会匹配 'en-US', 'en_GB' 等
        const codePattern = new RegExp(`^${langCodeLower}[-_]?`, 'i');
        
        // 在语言列表中查找匹配的语言代码
        const availableCodes = Object.keys(languageMap);
        const matchedCode = availableCodes.find(code => 
            codePattern.test(code.toLowerCase())
        );
        
        if (matchedCode) {
            return matchedCode;
        }
        
        // 4. 反向匹配，例如 'zh-CN' 应该能匹配到 'zh'
        if (langCodeLower.includes('-') || langCodeLower.includes('_')) {
            const baseCode = langCodeLower.split(/[-_]/)[0];
            if (languageMap[baseCode]) {
                return baseCode;
            }
            
            // 通过基础代码查找别名
            const baseCodeAliases = Object.entries(COMMON_LANGUAGE_ALIASES).find(
                ([code, aliases]) => code === baseCode || aliases.includes(baseCode)
            );
            
            if (baseCodeAliases) {
                const [mainCode, aliases] = baseCodeAliases;
                if (languageMap[mainCode]) {
                    return mainCode;
                }
                
                for (const alias of aliases) {
                    if (languageMap[alias]) {
                        return alias;
                    }
                }
            }
        }
        
        // 5. 最后尝试查找与部分代码匹配的任何语言
        const partialMatch = availableCodes.find(code => 
            code.toLowerCase().includes(langCodeLower) || 
            langCodeLower.includes(code.toLowerCase())
        );
        
        if (partialMatch) {
            return partialMatch;
        }
        
        // 如果所有匹配都失败，返回英语作为默认值
        return 'en';
    };

    /**
     * 验证语言代码是否受当前翻译器支持
     * @param langCode 语言代码
     * @param translatorType 翻译器类型（可选，默认使用当前翻译器）
     * @returns 验证后的语言代码
     */
    const validateLanguage = (langCode: string, translatorType?: string): string => {
        // 如果语言代码为空，返回auto作为API调用的默认值
        if (!langCode) return 'auto';
        
        const currentType = translatorType || defaultTranslator.value;
        
        // 尝试在指定翻译器的语言列表中查找相似的语言代码
        return findSimilarLanguage(langCode, currentType) || 'auto';
    };

    /**
     * 增加语言使用次数并添加到最近使用列表
     * @param langCode 语言代码
     * @param weight 权重，默认为1
     */
    const incrementLanguageUsage = (langCode: string, weight: number = 1): void => {
        if (!langCode || langCode === 'auto') return;
        
        // 转换为小写，确保一致性
        const normalizedCode = langCode.toLowerCase();
        
        // 更新使用次数，乘以权重
        const currentCount = languageUsageCount.value[normalizedCode] || 0;
        languageUsageCount.value[normalizedCode] = currentCount + weight;
        
        // 更新最近使用的语言列表
        updateRecentLanguages(normalizedCode);
    };
    
    /**
     * 更新最近使用的语言列表
     * @param langCode 语言代码
     */
    const updateRecentLanguages = (langCode: string): void => {
        if (!langCode) return;
        
        // 如果已经在列表中，先移除它
        const index = recentLanguages.value.indexOf(langCode);
        if (index !== -1) {
            recentLanguages.value.splice(index, 1);
        }
        
        // 添加到列表开头
        recentLanguages.value.unshift(langCode);
        
        // 保持列表最多10个元素
        if (recentLanguages.value.length > 10) {
            recentLanguages.value = recentLanguages.value.slice(0, 10);
        }
    };
    
    /**
     * 获取按使用频率排序的语言列表
     * @param translatorType 翻译器类型
     * @param grouped 是否分组返回（常用/其他）
     * @returns 排序后的语言列表或分组后的语言列表
     */
    const getSortedLanguages = (translatorType: string, grouped: boolean = false): [string, any][] | {frequent: [string, any][], others: [string, any][]} => {
        const languageMap = languageMaps.value[translatorType] || {};
        
        // 获取语言列表
        const languages = Object.entries(languageMap);
        
        // 按使用频率排序
        const sortedLanguages = languages.sort(([codeA, infoA], [codeB, infoB]) => {
            // 获取使用次数，默认为0
            const countA = languageUsageCount.value[codeA.toLowerCase()] || 0;
            const countB = languageUsageCount.value[codeB.toLowerCase()] || 0;
            
            // 首先按使用频率降序排序
            if (countB !== countA) {
                return countB - countA;
            }
            
            // 其次按最近使用情况排序
            const recentIndexA = recentLanguages.value.indexOf(codeA.toLowerCase());
            const recentIndexB = recentLanguages.value.indexOf(codeB.toLowerCase());
            
            if (recentIndexA !== -1 && recentIndexB !== -1) {
                return recentIndexA - recentIndexB;
            } else if (recentIndexA !== -1) {
                return -1;
            } else if (recentIndexB !== -1) {
                return 1;
            }
            
            // 如果使用频率和最近使用情况都相同，按名称排序
            const nameA = infoA.Name || infoA.name || codeA;
            const nameB = infoB.Name || infoB.name || codeB;
            
            return nameA.localeCompare(nameB);
        });
        
        // 如果不需要分组，直接返回排序后的列表
        if (!grouped) {
            return sortedLanguages;
        }
        
        // 分组：将有使用记录的语言归为常用组，其他归为其他组
        const frequentLanguages: [string, any][] = [];
        const otherLanguages: [string, any][] = [];
        
        sortedLanguages.forEach(lang => {
            const [code] = lang;
            const usageCount = languageUsageCount.value[code.toLowerCase()] || 0;
            const isInRecent = recentLanguages.value.includes(code.toLowerCase());
            
            if (usageCount > 0 || isInRecent) {
                frequentLanguages.push(lang);
            } else {
                otherLanguages.push(lang);
            }
        });
        
        return {
            frequent: frequentLanguages,
            others: otherLanguages
        };
    };

    /**
     * 翻译文本
     * @param text 待翻译文本
     * @param to 目标语言代码
     * @param translatorType 翻译器类型
     * @returns 翻译结果
     */
    const translateText = async (
        text: string, 
        to?: string,
        translatorType?: string
    ): Promise<TranslationResult> => {
        // 使用提供的参数或默认值
        const targetLang = to || defaultTargetLang.value;
        const translator = translatorType || defaultTranslator.value;
        
        // 处理空文本
        if (!text) {
            return {
                sourceText: '',
                translatedText: '',
                sourceLang: '',
                targetLang: targetLang,
                translatorType: translator,
                error: 'no text to translate'
            };
        }

        // 检测源语言
        const detected = detectLanguage(text);
        if (detected) {
            detectedSourceLang.value = detected;
        }
        
        // 使用检测到的语言或回退到auto
        let actualSourceLang = detectedSourceLang.value || 'auto';

        // 确认语言代码有效并针对当前翻译器进行匹配
        actualSourceLang = validateLanguage(actualSourceLang, translator);
        const actualTargetLang = validateLanguage(targetLang, translator);
        
        // 如果源语言和目标语言相同，则直接返回原文
        if (actualSourceLang !== 'auto' && actualSourceLang === actualTargetLang) {
            return {
                sourceText: text,
                translatedText: text,
                sourceLang: actualSourceLang,
                targetLang: actualTargetLang,
                translatorType: translator
            };
        }

        isTranslating.value = true;
        error.value = null;
        
        try {
            console.log(`翻译文本: 从 ${actualSourceLang} 到 ${actualTargetLang} 使用 ${translator} 翻译器`);
            
            // 调用翻译服务
            const translatedText = await TranslationService.TranslateWith(
                text, 
                actualSourceLang, 
                actualTargetLang, 
                translator
            );
            
            // 增加目标语言的使用频率，使用较大的权重
            incrementLanguageUsage(actualTargetLang, 3);
            
            // 如果源语言不是auto，也记录其使用情况，但权重较小
            if (actualSourceLang !== 'auto') {
                incrementLanguageUsage(actualSourceLang, 1);
            }
            
            // 构建结果
            const result: TranslationResult = {
                sourceText: text,
                translatedText,
                sourceLang: actualSourceLang,
                targetLang: actualTargetLang,
                translatorType: translator
            };
            
            lastResult.value = result;
            return result;
        } catch (err) {
            // 处理错误
            const errorMessage = err instanceof Error ? err.message : 'translation failed';

            error.value = errorMessage;

            const result: TranslationResult = {
                sourceText: text,
                translatedText: '',
                sourceLang: actualSourceLang,
                targetLang: actualTargetLang,
                translatorType: translator,
                error: errorMessage
            };
            
            lastResult.value = result;
            return result;
        } finally {
            isTranslating.value = false;
        }
    };

    /**
     * 设置默认翻译配置
     * @param config 配置对象
     */
    const setDefaultConfig = (config: {
        targetLang?: string;
        translatorType?: string;
    }): void => {
        let changed = false;
        
        if (config.translatorType && config.translatorType !== defaultTranslator.value) {
            defaultTranslator.value = config.translatorType;
            // 切换翻译器时清空检测到的源语言，以便重新检测
            detectedSourceLang.value = '';
            changed = true;
        }
        
        if (config.targetLang) {
            // 验证目标语言是否支持
            const validLang = validateLanguage(config.targetLang, defaultTranslator.value);
            defaultTargetLang.value = validLang;
            changed = true;
        }
        
        if (changed) {
            console.log(`已更新默认翻译配置：翻译器=${defaultTranslator.value}，目标语言=${defaultTargetLang.value}`);
        }
    };

    // 初始化时加载可用翻译器
    loadAvailableTranslators();

    return {
        // 状态
        availableTranslators,
        isTranslating,
        lastResult,
        error,
        detectedSourceLang,
        defaultTargetLang,
        defaultTranslator,
        languageMaps,
        languageUsageCount,
        recentLanguages,
        
        // 计算属性
        hasTranslators,
        currentLanguageMap,
        
        // 方法
        loadAvailableTranslators,
        loadTranslatorLanguages,
        translateText,
        setDefaultConfig,
        detectLanguage,
        validateLanguage,
        findSimilarLanguage,
        getSortedLanguages,
        incrementLanguageUsage
    };
}, {
    persist: {
        key: 'voidraft-translation',
        storage: localStorage,
        pick: ['languageUsageCount', 'defaultTargetLang', 'defaultTranslator', 'recentLanguages']
    }
}); 