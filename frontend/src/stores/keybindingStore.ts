import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {ExtensionID, KeyBinding, KeyBindingCommand} from '@/../bindings/voidraft/internal/models/models';
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
        const groups = new Map<ExtensionID, KeyBinding[]>();

        for (const binding of keyBindings.value) {
            if (!groups.has(binding.extension)) {
                groups.set(binding.extension, []);
            }
            groups.get(binding.extension)!.push(binding);
        }

        return groups;
    });

    // 获取指定扩展的快捷键
    const getKeyBindingsByExtension = computed(() =>
        (extension: ExtensionID) =>
            keyBindings.value.filter(kb => kb.extension === extension)
    );

    // 按命令获取快捷键
    const getKeyBindingByCommand = computed(() =>
        (command: KeyBindingCommand) =>
            keyBindings.value.find(kb => kb.command === command)
    );

    /**
     * 从后端加载快捷键配置
     */
    const loadKeyBindings = async (): Promise<void> => {
        keyBindings.value = await GetAllKeyBindings();
    };

    /**
     * 检查是否存在指定命令的快捷键
     */
    const hasCommand = (command: KeyBindingCommand): boolean => {
        return keyBindings.value.some(kb => kb.command === command && kb.enabled);
    };


    /**
     * 获取扩展相关的所有扩展ID
     */
    const getAllExtensionIds = computed(() => {
        const extensionIds = new Set<ExtensionID>();
        for (const binding of keyBindings.value) {
            extensionIds.add(binding.extension);
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