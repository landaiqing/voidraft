import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {KeyBinding} from '@/../bindings/voidraft/internal/models/ent/models';
import {GetAllKeyBindings} from '@/../bindings/voidraft/internal/services/keybindingservice';

export const useKeybindingStore = defineStore('keybinding', () => {
    // 快捷键配置数据
    const keyBindings = ref<KeyBinding[]>([]);

    // 获取启用的快捷键
    const enabledKeyBindings = computed(() =>
        keyBindings.value.filter(kb => kb.enabled)
    );

    // 按扩展分组的快捷键
    const keyBindingsByExtension = computed(() => {
        const groups = new Map<string, KeyBinding[]>();

        for (const binding of keyBindings.value) {
            const ext = binding.extension || '';
            if (!groups.has(ext)) {
                groups.set(ext, []);
            }
            groups.get(ext)!.push(binding);
        }

        return groups;
    });

    // 获取指定扩展的快捷键
    const getKeyBindingsByExtension = computed(() =>
        (extension: string) =>
            keyBindings.value.filter(kb => kb.extension === extension)
    );

    // 按命令获取快捷键
    const getKeyBindingByCommand = computed(() =>
        (command: string) =>
            keyBindings.value.find(kb => kb.command === command)
    );

    /**
     * 从后端加载快捷键配置
     */
    const loadKeyBindings = async (): Promise<void> => {
        const result = await GetAllKeyBindings();
        keyBindings.value = result.filter((kb): kb is KeyBinding => kb !== null);
    };

    /**
     * 检查是否存在指定命令的快捷键
     */
    const hasCommand = (command: string): boolean => {
        return keyBindings.value.some(kb => kb.command === command && kb.enabled);
    };


    /**
     * 获取扩展相关的所有扩展ID
     */
    const getAllExtensionIds = computed(() => {
        const extensionIds = new Set<string>();
        for (const binding of keyBindings.value) {
            if (binding.extension) {
                extensionIds.add(binding.extension);
            }
        }
        return Array.from(extensionIds);
    });

    return {
        // 状态
        keyBindings,
        enabledKeyBindings,
        keyBindingsByExtension,
        getAllExtensionIds,

        // 计算属性
        getKeyBindingByCommand,
        getKeyBindingsByExtension,

        // 方法
        loadKeyBindings,
        hasCommand,
    };
}); 