import {createI18n} from 'vue-i18n';
import messages from './locales';
import { GetLanguage, SetLanguage } from '@/../bindings/voidraft/internal/services/configservice';
import { LanguageType } from '@/../bindings/voidraft/internal/models';

// 定义支持的语言类型
export type SupportedLocaleType = 'zh-CN' | 'en-US';

// 支持的语言列表
export const SUPPORTED_LOCALES = [
    {
        code: 'zh-CN' as SupportedLocaleType,
        name: '简体中文'
    },
    {
        code: 'en-US' as SupportedLocaleType,
        name: 'English'
    }
];

// 获取浏览器的默认语言
const getBrowserLanguage = (): SupportedLocaleType => {
    const browserLang = navigator.language;
    const langCode = browserLang.split('-')[0];

    // 检查是否支持此语言
    const supportedLang = SUPPORTED_LOCALES.find(locale =>
        locale.code.startsWith(langCode) || locale.code.split('-')[0] === langCode
    );

    return supportedLang?.code || 'zh-CN';
};

// 创建i18n实例
const i18n = createI18n({
    globalInjection: true,
    locale: 'zh-CN',
    fallbackLocale: 'zh-CN' as SupportedLocaleType,
    messages
});

// 立即从后端获取语言设置
GetLanguage().then(lang => {
    if (lang) {
        i18n.global.locale = lang as any;
        document.documentElement.setAttribute('lang', lang);
    }
}).catch(error => {
    console.error('Failed to get language from backend:', error);
    // 如果获取失败，使用浏览器语言作为后备
    const browserLang = getBrowserLanguage();
    i18n.global.locale = browserLang as any;
    document.documentElement.setAttribute('lang', browserLang);
});

// 切换语言的方法
export const setLocale = (locale: SupportedLocaleType) => {
    if (SUPPORTED_LOCALES.some(l => l.code === locale)) {
        // 更新后端配置
        SetLanguage(locale as LanguageType)
            .then(() => {
                i18n.global.locale = locale;
                document.documentElement.setAttribute('lang', locale);
            })
            .catch(error => {
                console.error('Failed to set language:', error);
            });
    }
};

export default i18n; 