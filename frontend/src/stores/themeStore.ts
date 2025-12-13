import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {SystemThemeType} from '@/../bindings/voidraft/internal/models/models';
import {Type as ThemeType} from '@/../bindings/voidraft/internal/models/ent/theme/models';
import {ThemeService} from '@/../bindings/voidraft/internal/services';
import {useConfigStore} from './configStore';
import {useEditorStore} from './editorStore';
import type {ThemeColors} from '@/views/editor/theme/types';
import {cloneThemeColors, FALLBACK_THEME_NAME, themePresetList, themePresetMap} from '@/views/editor/theme/presets';

type ThemeColorConfig = { [_: string]: any };
type ThemeOption = { name: string; type: ThemeType };

const resolveThemeName = (name?: string) =>
    name && themePresetMap[name] ? name : FALLBACK_THEME_NAME;

const createThemeOptions = (type: ThemeType): ThemeOption[] =>
    themePresetList
        .filter(preset => preset.type === type)
        .map(preset => ({name: preset.name, type: preset.type}));

const darkThemeOptions = createThemeOptions(ThemeType.TypeDark);
const lightThemeOptions = createThemeOptions(ThemeType.TypeLight);

const cloneColors = (colors: ThemeColorConfig): ThemeColors =>
    JSON.parse(JSON.stringify(colors)) as ThemeColors;

const getPresetColors = (name: string): ThemeColors => {
    const preset = themePresetMap[name] ?? themePresetMap[FALLBACK_THEME_NAME];
    const colors = cloneThemeColors(preset.colors);
    colors.themeName = name;
    return colors;
};

const fetchThemeColors = async (themeName: string): Promise<ThemeColors> => {
    const safeName = resolveThemeName(themeName);
    try {
        const theme = await ThemeService.GetThemeByKey(safeName);
        if (theme?.colors) {
            const colors = cloneColors(theme.colors);
            colors.themeName = safeName;
            return colors;
        }
    } catch (error) {
        console.error('Failed to load theme override:', error);
    }
    return getPresetColors(safeName);
};

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

    const availableThemes = computed<ThemeOption[]>(() =>
        isDarkMode.value ? darkThemeOptions : lightThemeOptions
    );

    const applyThemeToDOM = (theme: SystemThemeType) => {
        const themeMap = {
            [SystemThemeType.SystemThemeAuto]: 'auto',
            [SystemThemeType.SystemThemeDark]: 'dark',
            [SystemThemeType.SystemThemeLight]: 'light',
        };
        document.documentElement.setAttribute('data-theme', themeMap[theme]);
    };

    const loadThemeColors = async (themeName?: string) => {
        const targetName = resolveThemeName(
            themeName || configStore.config?.appearance?.currentTheme
        );
        currentColors.value = await fetchThemeColors(targetName);
    };

    const initTheme = async () => {
        applyThemeToDOM(currentTheme.value);
        await loadThemeColors();
    };

    const setTheme = async (theme: SystemThemeType) => {
        await configStore.setSystemTheme(theme);
        applyThemeToDOM(theme);
        refreshEditorTheme();
    };

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

    const updateCurrentColors = (colors: Partial<ThemeColors>) => {
        if (!currentColors.value) return;
        Object.assign(currentColors.value, colors);
    };

    const saveCurrentTheme = async () => {
        if (!currentColors.value) {
            throw new Error('No theme selected');
        }

        const themeName = resolveThemeName(currentColors.value.themeName);
        currentColors.value.themeName = themeName;

        await ThemeService.UpdateTheme(themeName, currentColors.value as ThemeColorConfig);

        await loadThemeColors(themeName);
        refreshEditorTheme();
        return true;
    };

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
