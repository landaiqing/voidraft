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
        } catch (err) {
            environment.value = null;
        } finally {
            isLoading.value = false;
        }
    };

    return {
        // 状态
        environment,
        isLoading,

        // 计算属性
        isWindows,
        isMacOS,
        isLinux,
        titleBarHeight,

        // 方法
        initializeSystemInfo,
    };
}); 