import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Extension, ExtensionID, ExtensionCategory, ExtensionSettings } from '@/../bindings/voidraft/internal/models/models'
import { ExtensionService } from '@/../bindings/voidraft/internal/services'

export const useExtensionStore = defineStore('extension', () => {
    // 扩展配置数据
    const extensions = ref<Extension[]>([])
    const settings = ref<ExtensionSettings | null>(null)

    // 获取启用的扩展
    const enabledExtensions = computed(() =>
        extensions.value.filter(ext => ext.enabled)
    )

    // 根据分类获取扩展
    const getExtensionsByCategory = computed(() =>
        (category: ExtensionCategory) =>
            extensions.value.filter(ext => ext.category === category)
    )

    // 获取启用的扩展按分类分组
    const enabledExtensionsByCategory = computed(() => {
        const grouped = new Map<ExtensionCategory, Extension[]>()
        enabledExtensions.value.forEach(ext => {
            if (!grouped.has(ext.category)) {
                grouped.set(ext.category, [])
            }
            grouped.get(ext.category)!.push(ext)
        })
        return grouped
    })

    /**
     * 从后端加载扩展配置
     */
    const loadExtensions = async (): Promise<void> => {
        try {
            extensions.value = await ExtensionService.GetAllExtensions()
        } catch (err) {
            console.error('Failed to load extensions:', err)
        }
    }

    /**
     * 检查扩展是否启用
     */
    const isExtensionEnabled = (id: ExtensionID): boolean => {
        const extension = extensions.value.find(ext => ext.id === id)
        return extension?.enabled ?? false
    }

    /**
     * 获取扩展配置
     */
    const getExtensionConfig = (id: ExtensionID): any => {
        const extension = extensions.value.find(ext => ext.id === id)
        return extension?.config ?? {}
    }

    return {
        // 状态
        extensions,
        settings,
        enabledExtensions,

        // 计算属性
        getExtensionsByCategory,
        enabledExtensionsByCategory,

        // 方法
        loadExtensions,
        isExtensionEnabled,
        getExtensionConfig
    }
}) 