import {Compartment, Extension} from '@codemirror/state';
import {EditorView, keymap} from '@codemirror/view';
import {indentSelection} from '@codemirror/commands';
import {indentUnit} from '@codemirror/language';

// Tab设置相关的compartment
export const tabSizeCompartment = new Compartment();
export const tabKeyCompartment = new Compartment();

// 自定义Tab键处理函数
export const tabHandler = (view: EditorView, tabSize: number): boolean => {
  // 如果有选中文本，使用indentSelection
  if (!view.state.selection.main.empty) {
    return indentSelection(view);
  }
  
  // 创建相应数量的空格
  const spaces = ' '.repeat(tabSize);
  
  // 在光标位置插入空格
  const {state, dispatch} = view;
  dispatch(state.update(state.replaceSelection(spaces), {scrollIntoView: true}));
  return true;
};

// 获取Tab相关的扩展
export const getTabExtensions = (tabSize: number, enableTabIndent: boolean): Extension[] => {
  const extensions: Extension[] = [];
  
  // 设置缩进单位
  extensions.push(tabSizeCompartment.of(indentUnit.of(' '.repeat(tabSize))));
  
  // 如果启用了Tab缩进，添加自定义Tab键映射
  if (enableTabIndent) {
    extensions.push(
      tabKeyCompartment.of(
        keymap.of([{
          key: "Tab",
          run: (view) => tabHandler(view, tabSize)
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
  enableTabIndent: boolean
) => {
  if (!view) return;
  
  // 更新indentUnit配置
  view.dispatch({
    effects: tabSizeCompartment.reconfigure(indentUnit.of(' '.repeat(tabSize)))
  });
  
  // 更新Tab键映射
  const tabKeymap = enableTabIndent
    ? keymap.of([{
        key: "Tab", 
        run: (view) => tabHandler(view, tabSize)
      }])
    : [];
  
  view.dispatch({
    effects: tabKeyCompartment.reconfigure(tabKeymap)
  });
}; 