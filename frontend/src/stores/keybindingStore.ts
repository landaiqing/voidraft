import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {KeyBinding} from '@/../bindings/voidraft/internal/models/ent/models';
import {KeyBindingService} from '@/../bindings/voidraft/internal/services';
import {KeyBindingType} from '@/../bindings/voidraft/internal/models/models';
import {useConfigStore} from './configStore';

export const useKeybindingStore = defineStore('keybinding', () => {
    const configStore = useConfigStore();

    // 快捷键配置数据
    const keyBindings = ref<KeyBinding[]>([]);

    /**
     * 从后端加载快捷键配置（根据当前配置的模式）
     */
    const loadKeyBindings = async (): Promise<void> => {
        const keymapMode = configStore.config.editing.keymapMode || KeyBindingType.Standard;
        const result = await KeyBindingService.GetKeyBindings(keymapMode);
        keyBindings.value = result.filter((kb): kb is KeyBinding => kb !== null);
    };

    /**
     * 更新快捷键绑定
     */
    const updateKeyBinding = async (id: number, key: string): Promise<void> => {
        await KeyBindingService.UpdateKeyBindingKeys(id, key);
        await loadKeyBindings();
    };

    return {
        // 状态
        keyBindings,
        // 方法
        loadKeyBindings,
        updateKeyBinding,
    };
}); 