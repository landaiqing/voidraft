import { LanguageType } from '@/../bindings/voidraft/internal/models/models';
import { SupportedLocaleType } from '@/i18n';

/**
 * 配置工具类
 */
export class ConfigUtils {
  /**
   * 将后端语言类型转换为前端语言代码
   */
  static backendLanguageToFrontend(language: LanguageType): SupportedLocaleType {
    return language === LanguageType.LangZhCN ? 'zh-CN' : 'en-US';
  }

  /**
   * 将前端语言代码转换为后端语言类型
   */
  static frontendLanguageToBackend(locale: SupportedLocaleType): LanguageType {
    return locale === 'zh-CN' ? LanguageType.LangZhCN : LanguageType.LangEnUS;
  }

  /**
   * 验证数值是否在指定范围内
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 验证配置值是否有效
   */
  static isValidConfigValue<T>(value: T, validValues: readonly T[]): boolean {
    return validValues.includes(value);
  }

  /**
   * 获取配置的默认值
   */
  static getDefaultValue<T>(key: string, defaults: Record<string, { default: T }>): T {
    return defaults[key]?.default;
  }
} 