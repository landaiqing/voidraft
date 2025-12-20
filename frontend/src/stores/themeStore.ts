import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {SystemThemeType} from '@/../bindings/voidraft/internal/models/models';
import {Type as ThemeType} from '@/../bindings/voidraft/internal/models/ent/theme/models';
import {ThemeService} from '@/../bindings/voidraft/internal/services';
import {useConfigStore} from './configStore';
import {useEditorStore} from './editorStore';
import type {ThemeColors} from '@/views/editor/theme/types';
import {cloneThemeColors, FALLBACK_THEME_NAME, themePresetList, themePresetMap} from '@/views/editor/theme/presets';

// 类型定义
type ThemeOption = {name: string; type: ThemeType};

// 解析主题名称，确保返回有效的主题
const resolveThemeName = (name?: string): string =>
    name && themePresetMap[name] ? name : FALLBACK_THEME_NAME;

// 根据主题类型创建主题选项列表
const createThemeOptions = (type: ThemeType): ThemeOption[] =>
    themePresetList
        .filter(preset => preset.type === type)
        .map(preset => ({name: preset.name, type: preset.type}));

export const useThemeStore = defineStore('theme', () => {
    const configStore = useConfigStore();
    const currentColors = ref<ThemeColors | null>(null);

    const currentTheme = computed(
        () => configStore.config?.appearance?.systemTheme || SystemThemeType.SystemThemeAuto
    );

    const isDarkMode = computed(
        () =>
            currentTheme.value === SystemThemeType.SystemThemeDark ||
            (currentTheme.value === SystemThemeType.SystemThemeAuto &&
                window.matchMedia('(prefers-color-scheme: dark)').matches)
    );

    // 根据当前模式动态计算可用主题列表
    const availableThemes = computed<ThemeOption[]>(() =>
        createThemeOptions(isDarkMode.value ? ThemeType.TypeDark : ThemeType.TypeLight)
    );

    // 应用主题到 DOM
    const applyThemeToDOM = (theme: SystemThemeType) => {
        const themeMap = {
            [SystemThemeType.SystemThemeAuto]: 'auto',
            [SystemThemeType.SystemThemeDark]: 'dark',
            [SystemThemeType.SystemThemeLight]: 'light',
        };
        document.documentElement.setAttribute('data-theme', themeMap[theme]);
    };

    // 获取预设主题颜色
    const getPresetColors = (name: string): ThemeColors => {
        const preset = themePresetMap[name] ?? themePresetMap[FALLBACK_THEME_NAME];
        const colors = cloneThemeColors(preset.colors);
        colors.themeName = name;
        return colors;
    };

    // 从服务器获取主题颜色
    const fetchThemeColors = async (themeName: string): Promise<ThemeColors> => {
        const safeName = resolveThemeName(themeName);
        try {
            const theme = await ThemeService.GetThemeByName(safeName);
            if (theme?.colors) {
                const colors = cloneThemeColors(theme.colors as ThemeColors);
                colors.themeName = safeName;
                return colors;
            }
        } catch (error) {
            console.error('Failed to load theme override:', error);
        }
        return getPresetColors(safeName);
    };

    // 加载主题颜色
    const loadThemeColors = async (themeName?: string) => {
        const targetName = resolveThemeName(
            themeName || configStore.config?.appearance?.currentTheme
        );
        currentColors.value = await fetchThemeColors(targetName);
    };

    // 初始化主题
    const initTheme = async () => {
        applyThemeToDOM(currentTheme.value);
        await loadThemeColors();
        refreshEditorTheme();
    };

    // 设置系统主题
    const setTheme = async (theme: SystemThemeType) => {
        await configStore.setSystemTheme(theme);
        applyThemeToDOM(theme);
        refreshEditorTheme();
    };

    // 切换到指定主题
    const switchToTheme = async (themeName: string) => {
        if (!themePresetMap[themeName]) {
            console.error('Theme not found:', themeName);
            return false;
        }

        await loadThemeColors(themeName);
        await configStore.setCurrentTheme(themeName);
        refreshEditorTheme();
        return true;
    };

    // 更新当前主题颜色
    const updateCurrentColors = (colors: Partial<ThemeColors>) => {
        if (!currentColors.value) return;
        Object.assign(currentColors.value, colors);
    };

    // 保存当前主题
    const saveCurrentTheme = async () => {
        if (!currentColors.value) {
            throw new Error('No theme selected');
        }

        const themeName = resolveThemeName(currentColors.value.themeName);
        currentColors.value.themeName = themeName;

        await ThemeService.UpdateTheme(themeName, currentColors.value);

        await loadThemeColors(themeName);
        refreshEditorTheme();
        return true;
    };

    // 重置当前主题到默认值
    const resetCurrentTheme = async () => {
        if (!currentColors.value) {
            throw new Error('No theme selected');
        }

        const themeName = resolveThemeName(currentColors.value.themeName);
        await ThemeService.ResetTheme(themeName);

        await loadThemeColors(themeName);
        refreshEditorTheme();
        return true;
    };

    // 刷新编辑器主题
    const refreshEditorTheme = () => {
        applyThemeToDOM(currentTheme.value);
        const editorStore = useEditorStore();
        editorStore?.applyThemeSettings();
    };

    return {
        availableThemes,
        currentTheme,
        currentColors,
        isDarkMode,
        setTheme,
        switchToTheme,
        initTheme,
        updateCurrentColors,
        saveCurrentTheme,
        resetCurrentTheme,
        refreshEditorTheme,
        applyThemeToDOM,
    };
});
