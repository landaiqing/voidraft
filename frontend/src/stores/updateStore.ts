import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import {CheckForUpdates} from '@/../bindings/voidraft/internal/services/updateservice'
import {UpdateCheckResult} from '@/../bindings/voidraft/internal/services/models'
import {useConfigStore} from './configStore'

export const useUpdateStore = defineStore('update', () => {
    // 状态
    const isChecking = ref(false)
    const updateResult = ref<UpdateCheckResult | null>(null)
    const hasCheckedOnStartup = ref(false)

    // 计算属性
    const hasUpdate = computed(() => updateResult.value?.hasUpdate || false)
    const errorMessage = computed(() => updateResult.value?.error || '')

    // 检查更新
    const checkForUpdates = async (): Promise<boolean> => {
        if (isChecking.value) return false

        isChecking.value = true
        try {
            const result = await CheckForUpdates()
            updateResult.value = result
            return !result.error
        } catch (error) {
            updateResult.value = new UpdateCheckResult({
                hasUpdate: false,
                currentVer: '1.0.0',
                latestVer: '',
                releaseNotes: '',
                releaseURL: '',
                error: 'Network error'
            })
            return false
        } finally {
            isChecking.value = false
        }
    }

    // 启动时检查更新
    const checkOnStartup = async () => {
        if (hasCheckedOnStartup.value) return
        const configStore = useConfigStore()

        if (configStore.config.updates.autoUpdate) {
            await checkForUpdates()
        }
        hasCheckedOnStartup.value = true
    }

    // 打开发布页面
    const openReleaseURL = () => {
        if (updateResult.value?.releaseURL) {
            window.open(updateResult.value.releaseURL, '_blank')
        }
    }

    // 重置状态
    const reset = () => {
        updateResult.value = null
        isChecking.value = false
    }

    return {
        // 状态
        isChecking,
        updateResult,
        hasCheckedOnStartup,

        // 计算属性
        hasUpdate,
        errorMessage,

        // 方法
        checkForUpdates,
        checkOnStartup,
        openReleaseURL,
        reset
    }
}) 