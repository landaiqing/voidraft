import {createI18n} from 'vue-i18n';
import {useStorage} from '@vueuse/core';
import messages from './locales';

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

    return supportedLang?.code || 'zh-CN'; // 默认为中文
};

const storedLocale = useStorage<SupportedLocaleType>('voidraft-language', getBrowserLanguage());

// 创建i18n实例
const i18n = createI18n({
    lobalInjection: true,
    locale: storedLocale.value,
    fallbackLocale: 'zh-CN' as SupportedLocaleType,
    messages
});

// 切换语言的方法
export const setLocale = (locale: SupportedLocaleType) => {
    if (SUPPORTED_LOCALES.some(l => l.code === locale)) {
        storedLocale.value = locale;
        i18n.global.locale = locale;
        document.documentElement.setAttribute('lang', locale);
    }
};

// 初始设置html lang属性
document.documentElement.setAttribute('lang', storedLocale.value);

export default i18n; 