// Tab类型
export type TabType = 'spaces' | 'tab';

// 编辑器配置接口
export interface EditorConfig {
  fontSize: number;
  encoding: string;
  enableTabIndent: boolean;
  tabSize: number;
  tabType: TabType;
} 