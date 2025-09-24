import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {CheckForUpdates, ApplyUpdate, RestartApplication} from '@/../bindings/voidraft/internal/services/selfupdateservice';
import {SelfUpdateResult} from '@/../bindings/voidraft/internal/services/models';
import {useConfigStore} from './configStore';
import * as runtime from "@wailsio/runtime";

export const useUpdateStore = defineStore('update', () => {
    // 状态
    const isChecking = ref(false);
    const isUpdating = ref(false);
    const updateResult = ref<SelfUpdateResult | null>(null);
    const hasCheckedOnStartup = ref(false);
    const updateSuccess = ref(false);
    const errorMessage = ref('');

    // 计算属性
    const hasUpdate = computed(() => updateResult.value?.hasUpdate || false);

    // 检查更新
    const checkForUpdates = async (): Promise<boolean> => {
        if (isChecking.value) return false;

        // 重置错误信息
        errorMessage.value = '';
        isChecking.value = true;
        try {
            const result = await CheckForUpdates();
            if (result) {
                updateResult.value = result;
                if (result.error) {
                    errorMessage.value = result.error;
                    return false;
                }
                return true;
            }
            return false;
        } catch (error) {
            errorMessage.value = error instanceof Error ? error.message : 'Network error';
            return false;
        } finally {
            isChecking.value = false;
        }
    };

    // 应用更新
    const applyUpdate = async (): Promise<boolean> => {
        if (isUpdating.value) return false;

        // 重置错误信息
        errorMessage.value = '';
        isUpdating.value = true;
        try {
            const result = await ApplyUpdate();
            if (result) {
                updateResult.value = result;
                
                if (result.error) {
                    errorMessage.value = result.error;
                    return false;
                }
                
                if (result.updateApplied) {
                    updateSuccess.value = true;
                    return true;
                }
            }
            return false;
        } catch (error) {
            errorMessage.value = error instanceof Error ? error.message : 'Update failed';
            return false;
        } finally {
            isUpdating.value = false;
        }
    };

    // 重启应用
    const restartApplication = async (): Promise<boolean> => {
        try {
            await RestartApplication();
            return true;
        } catch (error) {
            errorMessage.value = error instanceof Error ? error.message : 'Restart failed';
            return false;
        }
    };

    // 启动时检查更新
    const checkOnStartup = async () => {
        if (hasCheckedOnStartup.value) return;
        const configStore = useConfigStore();

        if (configStore.config.updates.autoUpdate) {
            await checkForUpdates();
        }
        hasCheckedOnStartup.value = true;
    };

    // 打开发布页面
    const openReleaseURL = async () => {
        if (updateResult.value?.assetURL) {
            await runtime.Browser.OpenURL(updateResult.value.assetURL);
        }
    };

    // 重置状态
    const reset = () => {
        updateResult.value = null;
        isChecking.value = false;
        isUpdating.value = false;
        updateSuccess.value = false;
        errorMessage.value = '';
    };

    return {
        // 状态
        isChecking,
        isUpdating,
        updateResult,
        hasCheckedOnStartup,
        updateSuccess,
        errorMessage,

        // 计算属性
        hasUpdate,

        // 方法
        checkForUpdates,
        applyUpdate,
        restartApplication,
        checkOnStartup,
        openReleaseURL,
        reset
    };
}); 