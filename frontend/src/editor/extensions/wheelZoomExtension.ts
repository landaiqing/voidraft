import {EditorView} from '@codemirror/view';

// 处理滚轮缩放字体的事件处理函数
export const createWheelZoomHandler = (
  increaseFontSize: () => void,
  decreaseFontSize: () => void
) => {
  return (event: WheelEvent) => {
    // 检查是否按住了Ctrl键
    if (event.ctrlKey) {
      // 阻止默认行为（防止页面缩放）
      event.preventDefault();
      
      // 根据滚轮方向增大或减小字体
      if (event.deltaY < 0) {
        // 向上滚动，增大字体
        increaseFontSize();
      } else {
        // 向下滚动，减小字体
        decreaseFontSize();
      }
    }
  };
};

// 应用字体大小到编辑器
export const applyFontSize = (view: EditorView, fontSize: number) => {
  if (!view) return;
  
  // 更新编辑器的字体大小
  const editorDOM = view.dom;
  if (editorDOM) {
    editorDOM.style.fontSize = `${fontSize}px`;
  }
}; 