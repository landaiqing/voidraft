import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { Extension } from '@/../bindings/voidraft/internal/models/ent/models';
import { ExtensionService } from '@/../bindings/voidraft/internal/services';

export const useExtensionStore = defineStore('extension', () => {
    // 扩展配置数据
    const extensions = ref<Extension[]>([]);

    // 获取启用的扩展
    const enabledExtensions = computed(() =>
        extensions.value.filter(ext => ext.enabled)
    );

    // 获取启用的扩展ID列表 (key)
    const enabledExtensionIds = computed(() =>
        enabledExtensions.value.map(ext => ext.key).filter((k): k is string => k !== undefined)
    );

    /**
     * 从后端加载扩展配置
     */
    const loadExtensions = async (): Promise<void> => {
        try {
            const result = await ExtensionService.GetAllExtensions();
            extensions.value = result.filter((ext): ext is Extension => ext !== null);
        } catch (err) {
            console.error('[ExtensionStore] Failed to load extensions:', err);
        }
    };

    /**
     * 获取扩展配置
     */
    const getExtensionConfig = (key: string): any => {
        const extension = extensions.value.find(ext => ext.key === key);
        return extension?.config ?? {};
    };

    return {
        // 状态
        extensions,
        enabledExtensions,
        enabledExtensionIds,

        // 方法
        loadExtensions,
        getExtensionConfig,
    };
}); 