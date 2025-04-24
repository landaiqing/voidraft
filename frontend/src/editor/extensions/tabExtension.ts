import {Compartment, Extension} from '@codemirror/state';
import {EditorView, keymap} from '@codemirror/view';
import {indentSelection} from '@codemirror/commands';
import {indentUnit} from '@codemirror/language';
import {TabType} from '@/stores/editor';

// Tab设置相关的compartment
export const tabSizeCompartment = new Compartment();
export const tabKeyCompartment = new Compartment();

// 自定义Tab键处理函数
export const tabHandler = (view: EditorView, tabSize: number, tabType: TabType): boolean => {
  // 如果有选中文本，使用indentSelection
  if (!view.state.selection.main.empty) {
    return indentSelection(view);
  }
  
  // 根据tabType创建缩进字符
  const indent = tabType === 'spaces' ? ' '.repeat(tabSize) : '\t';
  
  // 在光标位置插入缩进字符
  const {state, dispatch} = view;
  dispatch(state.update(state.replaceSelection(indent), {scrollIntoView: true}));
  return true;
};

// 获取Tab相关的扩展
export const getTabExtensions = (tabSize: number, enableTabIndent: boolean, tabType: TabType): Extension[] => {
  const extensions: Extension[] = [];
  
  // 根据tabType设置缩进单位
  const indentStr = tabType === 'spaces' ? ' '.repeat(tabSize) : '\t';
  extensions.push(tabSizeCompartment.of(indentUnit.of(indentStr)));
  
  // 如果启用了Tab缩进，添加自定义Tab键映射
  if (enableTabIndent) {
    extensions.push(
      tabKeyCompartment.of(
        keymap.of([{
          key: "Tab",
          run: (view) => tabHandler(view, tabSize, tabType)
        }])
      )
    );
  } else {
    extensions.push(tabKeyCompartment.of([]));
  }
  
  return extensions;
};

// 更新Tab配置
export const updateTabConfig = (
  view: EditorView | null,
  tabSize: number, 
  enableTabIndent: boolean,
  tabType: TabType
) => {
  if (!view) return;
  
  // 根据tabType更新indentUnit配置
  const indentStr = tabType === 'spaces' ? ' '.repeat(tabSize) : '\t';
  view.dispatch({
    effects: tabSizeCompartment.reconfigure(indentUnit.of(indentStr))
  });
  
  // 更新Tab键映射
  const tabKeymap = enableTabIndent
    ? keymap.of([{
        key: "Tab", 
        run: (view) => tabHandler(view, tabSize, tabType)
      }])
    : [];
  
  view.dispatch({
    effects: tabKeyCompartment.reconfigure(tabKeymap)
  });
}; 