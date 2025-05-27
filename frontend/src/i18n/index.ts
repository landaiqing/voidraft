import {createI18n} from 'vue-i18n';
import messages from './locales';
import { ConfigService } from '@/../bindings/voidraft/internal/services';
import { LanguageType } from '@/../bindings/voidraft/internal/models';
import { ConfigUtils } from '@/utils/configUtils';

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

// 从后端获取语言设置
const initializeLanguage = async () => {
    try {
        // 使用新的配置服务方法获取语言设置
        const language = await ConfigService.Get('editor.language') as LanguageType;
        if (language) {
            const frontendLocale = ConfigUtils.backendLanguageToFrontend(language);
            i18n.global.locale = frontendLocale as any;
        }
    } catch (error) {
        console.error('Failed to get language from backend:', error);
        // 如果获取失败，使用浏览器语言作为后备
        const browserLang = getBrowserLanguage();
        i18n.global.locale = browserLang as any;
    }
};

// 立即初始化语言
initializeLanguage();

// 切换语言的方法
export const setLocale = async (locale: SupportedLocaleType) => {
    if (SUPPORTED_LOCALES.some(l => l.code === locale)) {
        try {
            // 转换为后端语言类型
            const backendLanguage = ConfigUtils.frontendLanguageToBackend(locale);
            
            // 使用新的配置服务方法设置语言
            await ConfigService.Set('editor.language', backendLanguage);
            
            // 更新前端语言
            i18n.global.locale = locale;
        } catch (error) {
            console.error('Failed to set language:', error);
        }
    }
};

export default i18n; 