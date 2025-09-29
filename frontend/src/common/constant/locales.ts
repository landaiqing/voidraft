export type SupportedLocaleType = 'zh-CN' | 'en-US';

// 支持的语言列表
export const SUPPORTED_LOCALES = [
    {
        code: 'en-US' as SupportedLocaleType,
        name: 'English'
    },
    {
        code: 'zh-CN' as SupportedLocaleType,
        name: '简体中文'
    }
] as const;