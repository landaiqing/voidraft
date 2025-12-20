import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { Extension } from '@/../bindings/voidraft/internal/models/ent/models';
import { ExtensionService } from '@/../bindings/voidraft/internal/services';

export const useExtensionStore = defineStore('extension', () => {
    // 扩展配置数据
    const extensions = ref<Extension[]>([]);

    /**
     * 从后端加载扩展配置
     */
    const loadExtensions = async (): Promise<void> => {
        try {
            const result = await ExtensionService.GetExtensions();
            extensions.value = result.filter((ext): ext is Extension => ext !== null);
        } catch (err) {
            console.error('[ExtensionStore] Failed to load extensions:', err);
        }
    };

    /**
     * 获取扩展配置
     */
    const getExtensionConfig = async (id: number): Promise<any> => {
        try {
            const config = await ExtensionService.GetExtensionConfig(id);
            return config ?? {};
        } catch (err) {
            console.error('[ExtensionStore] Failed to get extension config:', err);
            return {};
        }
    };

    return {
        // 状态
        extensions,
        // 方法
        loadExtensions,
        getExtensionConfig,
    };
}); 