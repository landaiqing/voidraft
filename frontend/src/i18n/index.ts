import {createI18n} from 'vue-i18n';
import messages from './locales';

// 创建i18n实例
const i18n = createI18n({
    compositionOnly: false,
    globalInjection: true,
    silentTranslationWarn: true,
    locale: 'zh-CN',
    fallbackLocale: 'zh-CN',
    silentFallbackWarn: true,
    missingWarn: true,
    fallbackWarn: false,
    messages
});

export default i18n; 