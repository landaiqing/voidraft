import type { ThemeType } from '@/../bindings/voidraft/internal/models';

// 主题配置信息
export interface ThemeInfo {
  id: ThemeType;
  name: string;
  displayName: string;
  isDark: boolean;
  previewColors: {
    background: string;
    foreground: string;
    keyword: string;
    string: string;
    function: string;
    comment: string;
  };
}

// 可用主题列表
export const AVAILABLE_THEMES: ThemeInfo[] = [
  {
    id: 'default-dark' as ThemeType,
    name: 'default-dark',
    displayName: '深色默认',
    isDark: true,
    previewColors: {
      background: '#252B37',
      foreground: '#9BB586',
      keyword: '#FF79C6',
      string: '#F1FA8C',
      function: '#50FA7B',
      comment: '#6272A4'
    }
  },
  {
    id: 'dracula' as ThemeType,
    name: 'dracula',
    displayName: 'Dracula',
    isDark: true,
    previewColors: {
      background: '#282A36',
      foreground: '#F8F8F2',
      keyword: '#FF79C6',
      string: '#F1FA8C',
      function: '#50FA7B',
      comment: '#6272A4'
    }
  },
  {
    id: 'aura' as ThemeType,
    name: 'aura',
    displayName: 'Aura',
    isDark: true,
    previewColors: {
      background: '#21202e',
      foreground: '#edecee',
      keyword: '#a277ff',
      string: '#61ffca',
      function: '#ffca85',
      comment: '#6d6d6d'
    }
  },
  {
    id: 'github-dark' as ThemeType,
    name: 'github-dark',
    displayName: 'GitHub 深色',
    isDark: true,
    previewColors: {
      background: '#24292e',
      foreground: '#d1d5da',
      keyword: '#f97583',
      string: '#9ecbff',
      function: '#79b8ff',
      comment: '#6a737d'
    }
  },
  {
    id: 'github-light' as ThemeType,
    name: 'github-light',
    displayName: 'GitHub 浅色',
    isDark: false,
    previewColors: {
      background: '#fff',
      foreground: '#444d56',
      keyword: '#d73a49',
      string: '#032f62',
      function: '#005cc5',
      comment: '#6a737d'
    }
  },
  {
    id: 'material-dark' as ThemeType,
    name: 'material-dark',
    displayName: 'Material 深色',
    isDark: true,
    previewColors: {
      background: '#263238',
      foreground: '#EEFFFF',
      keyword: '#C792EA',
      string: '#C3E88D',
      function: '#82AAFF',
      comment: '#546E7A'
    }
  },
  {
    id: 'material-light' as ThemeType,
    name: 'material-light',
    displayName: 'Material 浅色',
    isDark: false,
    previewColors: {
      background: '#FAFAFA',
      foreground: '#90A4AE',
      keyword: '#7C4DFF',
      string: '#91B859',
      function: '#6182B8',
      comment: '#90A4AE'
    }
  },
  {
    id: 'solarized-dark' as ThemeType,
    name: 'solarized-dark',
    displayName: 'Solarized 深色',
    isDark: true,
    previewColors: {
      background: '#002B36',
      foreground: '#93A1A1',
      keyword: '#859900',
      string: '#2AA198',
      function: '#268BD2',
      comment: '#586E75'
    }
  },
  {
    id: 'solarized-light' as ThemeType,
    name: 'solarized-light',
    displayName: 'Solarized 浅色',
    isDark: false,
    previewColors: {
      background: '#FDF6E3',
      foreground: '#586E75',
      keyword: '#859900',
      string: '#2AA198',
      function: '#268BD2',
      comment: '#93A1A1'
    }
  },
  {
    id: 'tokyo-night' as ThemeType,
    name: 'tokyo-night',
    displayName: 'Tokyo Night',
    isDark: true,
    previewColors: {
      background: '#1a1b26',
      foreground: '#787c99',
      keyword: '#bb9af7',
      string: '#9ece6a',
      function: '#7aa2f7',
      comment: '#444b6a'
    }
  },
  {
    id: 'tokyo-night-storm' as ThemeType,
    name: 'tokyo-night-storm',
    displayName: 'Tokyo Night Storm',
    isDark: true,
    previewColors: {
      background: '#24283b',
      foreground: '#7982a9',
      keyword: '#bb9af7',
      string: '#9ece6a',
      function: '#7aa2f7',
      comment: '#565f89'
    }
  },
  {
    id: 'tokyo-night-day' as ThemeType,
    name: 'tokyo-night-day',
    displayName: 'Tokyo Night Day',
    isDark: false,
    previewColors: {
      background: '#e1e2e7',
      foreground: '#6a6f8e',
      keyword: '#9854f1',
      string: '#587539',
      function: '#2e7de9',
      comment: '#9da3c2'
    }
  }
];

// 根据主题ID获取主题信息
export function getThemeInfo(themeId: ThemeType): ThemeInfo | undefined {
  return AVAILABLE_THEMES.find(theme => theme.id === themeId);
}

// 获取所有深色主题
export function getDarkThemes(): ThemeInfo[] {
  return AVAILABLE_THEMES.filter(theme => theme.isDark);
}

// 获取所有浅色主题
export function getLightThemes(): ThemeInfo[] {
  return AVAILABLE_THEMES.filter(theme => !theme.isDark);
} 