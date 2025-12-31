/**
 * 配置工具类
 */
export class ConfigUtils {

    /**
     * 验证数值是否在指定范围内
     */
    static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

} 