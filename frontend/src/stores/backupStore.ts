import {defineStore} from 'pinia'
import {computed, readonly, ref} from 'vue'
import type {GitBackupConfig} from '@/../bindings/voidraft/internal/models'
import {BackupService} from '@/../bindings/voidraft/internal/services'
import {useConfigStore} from '@/stores/configStore'

/**
 * Minimalist Backup Store
 */
export const useBackupStore = defineStore('backup', () => {
    // Core state
    const config = ref<GitBackupConfig | null>(null)
    const isPushing = ref(false)
    const error = ref<string | null>(null)
    const isInitialized = ref(false)
    
    // Backup result states
    const pushSuccess = ref(false)
    const pushError = ref(false)
    
    // Timers for auto-hiding status icons and error messages
    let pushStatusTimer: number | null = null
    let errorTimer: number | null = null

    // 获取configStore
    const configStore = useConfigStore()

    // Computed properties
    const isEnabled = computed(() => configStore.config.backup.enabled)
    const isConfigured = computed(() => configStore.config.backup.repo_url)

    // 清除状态显示
    const clearPushStatus = () => {
        if (pushStatusTimer !== null) {
            window.clearTimeout(pushStatusTimer)
            pushStatusTimer = null
        }
        pushSuccess.value = false
        pushError.value = false
    }

    // 清除错误信息
    const clearError = () => {
        if (errorTimer !== null) {
            window.clearTimeout(errorTimer)
            errorTimer = null
        }
        error.value = null
    }

    // 设置错误信息并自动清除
    const setErrorWithAutoHide = (errorMessage: string, hideAfter: number = 5000) => {
        clearError() // 清除之前的错误定时器
        error.value = errorMessage
        errorTimer = window.setTimeout(() => {
            error.value = null
            errorTimer = null
        }, hideAfter)
    }

    // Push to remote repository
    const pushToRemote = async () => {
        if (isPushing.value || !isConfigured.value) return

        isPushing.value = true
        clearError() // 清除之前的错误信息
        clearPushStatus()

        try {
            await BackupService.PushToRemote()
            // 显示成功状态，并设置3秒后自动消失
            pushSuccess.value = true
            pushStatusTimer = window.setTimeout(() => {
                pushSuccess.value = false
                pushStatusTimer = null
            }, 3000)
        } catch (err: any) {
            setErrorWithAutoHide(err?.message || 'Backup operation failed')
            // 显示错误状态，并设置3秒后自动消失
            pushError.value = true
            pushStatusTimer = window.setTimeout(() => {
                pushError.value = false
                pushStatusTimer = null
            }, 3000)
        } finally {
            isPushing.value = false
        }
    }

    // 初始化备份服务（只在应用启动时调用一次）
    const initialize = async () => {
        if (!isEnabled.value) return
        
        // 避免重复初始化
        if (isInitialized.value) return
        
        clearError() // 清除之前的错误信息
        try {
            await BackupService.Initialize()
            isInitialized.value = true
        } catch (err: any) {
            setErrorWithAutoHide(err?.message || 'Failed to initialize backup service')
        }
    }


    return {
        // State
        config: readonly(config),
        isPushing: readonly(isPushing),
        error: readonly(error),
        isInitialized: readonly(isInitialized),
        pushSuccess: readonly(pushSuccess),
        pushError: readonly(pushError),

        // Computed
        isEnabled,
        isConfigured,

        // Methods
        pushToRemote,
        initialize,
        clearError
    }
})