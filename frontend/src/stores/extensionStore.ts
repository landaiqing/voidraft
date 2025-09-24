import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { Extension, ExtensionID } from '@/../bindings/voidraft/internal/models/models';
import { ExtensionService } from '@/../bindings/voidraft/internal/services';

export const useExtensionStore = defineStore('extension', () => {
    // 扩展配置数据
    const extensions = ref<Extension[]>([]);

    // 获取启用的扩展
    const enabledExtensions = computed(() =>
        extensions.value.filter(ext => ext.enabled)
    );

    // 获取启用的扩展ID列表
    const enabledExtensionIds = computed(() =>
        enabledExtensions.value.map(ext => ext.id)
    );

    /**
     * 从后端加载扩展配置
     */
    const loadExtensions = async (): Promise<void> => {
        try {
            extensions.value = await ExtensionService.GetAllExtensions();
        } catch (err) {
            console.error('[ExtensionStore] Failed to load extensions:', err);
        }
    };

    /**
     * 获取扩展配置
     */
    const getExtensionConfig = (id: ExtensionID): any => {
        const extension = extensions.value.find(ext => ext.id === id);
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