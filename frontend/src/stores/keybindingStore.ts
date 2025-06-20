import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import {KeyBinding, KeyBindingCommand} from '@/../bindings/voidraft/internal/models/models'
import {GetAllKeyBindings} from '@/../bindings/voidraft/internal/services/keybindingservice'

export const useKeybindingStore = defineStore('keybinding', () => {
    // 快捷键配置数据
    const keyBindings = ref<KeyBinding[]>([])


    // 获取启用的快捷键
    const enabledKeyBindings = computed(() =>
        keyBindings.value.filter(kb => kb.enabled)
    )

    // 按命令获取快捷键
    const getKeyBindingByCommand = computed(() =>
        (command: KeyBindingCommand) =>
            keyBindings.value.find(kb => kb.command === command)
    )

    /**
     * 从后端加载快捷键配置
     */
    const loadKeyBindings = async (): Promise<void> => {
        try {
            keyBindings.value = await GetAllKeyBindings()
        } catch (err) {
            console.error(err)
        }
    }

    /**
     * 检查是否存在指定命令的快捷键
     */
    const hasCommand = (command: KeyBindingCommand): boolean => {
        return keyBindings.value.some(kb => kb.command === command && kb.enabled)
    }

    return {
        // 状态
        keyBindings,
        enabledKeyBindings,

        // 计算属性
        getKeyBindingByCommand,

        // 方法
        loadKeyBindings,
        hasCommand
    }
}) 