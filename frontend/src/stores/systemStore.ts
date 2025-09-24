import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import * as runtime from '@wailsio/runtime';

export interface SystemEnvironment {
    OS: string;
    Arch: string;
    Debug: boolean;
    OSInfo: {
        Name: string;
        Branding: string;
        Version: string;
        ID: string;
    };
    PlatformInfo?: Record<string, string>;
}

export const useSystemStore = defineStore('system', () => {
    // 状态
    const environment = ref<SystemEnvironment | null>(null);
    const isLoading = ref(false);
    
    // 窗口置顶状态管理
    const isWindowOnTop = ref<boolean>(false);

    // 计算属性
    const isWindows = computed(() => environment.value?.OS === 'windows');
    const isMacOS = computed(() => environment.value?.OS === 'darwin');
    const isLinux = computed(() => environment.value?.OS === 'linux');

    // 获取标题栏高度
    const titleBarHeight = computed(() => {
        if (isWindows.value) return '32px';
        if (isMacOS.value) return '28px';
        return '34px'; // Linux 默认
    });

    // 初始化系统信息
    const initializeSystemInfo = async (): Promise<void> => {
        if (isLoading.value) return;

        isLoading.value = true;

        try {
            environment.value = await runtime.System.Environment();
        } catch (_err) {
            environment.value = null;
        } finally {
            isLoading.value = false;
        }
    };

    // 设置窗口置顶状态
    const setWindowOnTop = async (isPinned: boolean): Promise<void> => {
        isWindowOnTop.value = isPinned;
        try {
            await runtime.Window.SetAlwaysOnTop(isPinned);
        } catch (error) {
            console.error('Failed to set window always on top:', error);
        }
    };

    // 切换窗口置顶状态
    const toggleWindowOnTop = async (): Promise<void> => {
        await setWindowOnTop(!isWindowOnTop.value);
    };

    // 重置临时置顶状态（不调用系统API）
    const resetWindowOnTop = (): void => {
        isWindowOnTop.value = false;
    };

    return {
        // 状态
        environment,
        isLoading,
        isWindowOnTop,

        // 计算属性
        isWindows,
        isMacOS,
        isLinux,
        titleBarHeight,

        // 方法
        initializeSystemInfo,
        setWindowOnTop,
        toggleWindowOnTop,
        resetWindowOnTop,
    };
}, {
    persist: {
        key: 'voidraft-system',
        storage: localStorage,
        pick: ['isWindowOnTop']
    }
}); 