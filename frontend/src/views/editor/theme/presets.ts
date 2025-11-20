import type {ThemeColors} from './types';
import {ThemeType} from '@/../bindings/voidraft/internal/models/models';
import {defaultDarkColors} from './dark/default-dark';
import {defaultLightColors} from './light/default-light';
import {config as draculaColors} from './dark/dracula';
import {config as auraColors} from './dark/aura';
import {config as githubDarkColors} from './dark/github-dark';
import {config as materialDarkColors} from './dark/material-dark';
import {config as oneDarkColors} from './dark/one-dark';
import {config as solarizedDarkColors} from './dark/solarized-dark';
import {config as tokyoNightColors} from './dark/tokyo-night';
import {config as tokyoNightStormColors} from './dark/tokyo-night-storm';
import {config as githubLightColors} from './light/github-light';
import {config as materialLightColors} from './light/material-light';
import {config as solarizedLightColors} from './light/solarized-light';
import {config as tokyoNightDayColors} from './light/tokyo-night-day';

export interface ThemePreset {
    name: string;
    type: ThemeType;
    colors: ThemeColors;
}

export const FALLBACK_THEME_NAME = defaultDarkColors.themeName;

export const themePresetList: ThemePreset[] = [
    {name: defaultDarkColors.themeName, type: ThemeType.ThemeTypeDark, colors: defaultDarkColors},
    {name: draculaColors.themeName, type: ThemeType.ThemeTypeDark, colors: draculaColors},
    {name: auraColors.themeName, type: ThemeType.ThemeTypeDark, colors: auraColors},
    {name: githubDarkColors.themeName, type: ThemeType.ThemeTypeDark, colors: githubDarkColors},
    {name: materialDarkColors.themeName, type: ThemeType.ThemeTypeDark, colors: materialDarkColors},
    {name: oneDarkColors.themeName, type: ThemeType.ThemeTypeDark, colors: oneDarkColors},
    {name: solarizedDarkColors.themeName, type: ThemeType.ThemeTypeDark, colors: solarizedDarkColors},
    {name: tokyoNightColors.themeName, type: ThemeType.ThemeTypeDark, colors: tokyoNightColors},
    {name: tokyoNightStormColors.themeName, type: ThemeType.ThemeTypeDark, colors: tokyoNightStormColors},
    {name: defaultLightColors.themeName, type: ThemeType.ThemeTypeLight, colors: defaultLightColors},
    {name: githubLightColors.themeName, type: ThemeType.ThemeTypeLight, colors: githubLightColors},
    {name: materialLightColors.themeName, type: ThemeType.ThemeTypeLight, colors: materialLightColors},
    {name: solarizedLightColors.themeName, type: ThemeType.ThemeTypeLight, colors: solarizedLightColors},
    {name: tokyoNightDayColors.themeName, type: ThemeType.ThemeTypeLight, colors: tokyoNightDayColors},
];

export const themePresetMap: Record<string, ThemePreset> = themePresetList.reduce(
    (map, preset) => {
        map[preset.name] = preset;
        return map;
    },
    {} as Record<string, ThemePreset>
);

export const cloneThemeColors = (colors: ThemeColors): ThemeColors =>
    JSON.parse(JSON.stringify(colors)) as ThemeColors;
