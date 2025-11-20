import { EditorView } from "@codemirror/view";
import type { ThemeColors } from "@/views/editor/theme/types";

/**
 * 创建 Markdown 预览面板的主题样式
 */
export function createMarkdownPreviewTheme(colors: ThemeColors) {
  // GitHub 官方颜色变量
  const isDark = colors.dark;
  
  // GitHub Light 主题颜色
  const lightColors = {
    fg: {
      default: "#1F2328",
      muted: "#656d76",
      subtle: "#6e7781"
    },
    border: {
      default: "#d0d7de",
      muted: "#d8dee4"
    },
    canvas: {
      default: "#ffffff",
      subtle: "#f6f8fa"
    },
    accent: {
      fg: "#0969da",
      emphasis: "#0969da"
    }
  };
  
  // GitHub Dark 主题颜色
  const darkColors = {
    fg: {
      default: "#e6edf3",
      muted: "#7d8590",
      subtle: "#6e7681"
    },
    border: {
      default: "#30363d",
      muted: "#21262d"
    },
    canvas: {
      default: "#0d1117",
      subtle: "#161b22"
    },
    accent: {
      fg: "#2f81f7",
      emphasis: "#2f81f7"
    }
  };
  
  const ghColors = isDark ? darkColors : lightColors;
  
  return EditorView.theme({
    // 面板容器
    ".cm-markdown-preview-panel": {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    },

    // 拖动调整大小的手柄
    ".cm-preview-resize-handle": {
      width: "100%",
      height: "3px",
      backgroundColor: colors.borderColor,
      cursor: "ns-resize",
      position: "relative",
      flexShrink: 0,
      transition: "background-color 0.2s ease",
      "&:hover": {
        backgroundColor: colors.selection
      },
      "&.dragging": {
        backgroundColor: colors.selection
      }
    },

      // 面板动画效果
      '.cm-panels.cm-panels-top': {
          borderBottom: '2px solid black'
      },
      '.cm-panels.cm-panels-bottom': {
          animation: 'panelSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      },
      '@keyframes panelSlideUp': {
          from: {
              transform: 'translateY(100%)',
              opacity: '0'
          },
          to: {
              transform: 'translateY(0)',
              opacity: '1'
          }
      },
      '@keyframes panelSlideDown': {
          from: {
              transform: 'translateY(0)',
              opacity: '1'
          },
          to: {
              transform: 'translateY(100%)',
              opacity: '0'
          }
      },

    // 内容区域
    ".cm-preview-content": {
      flex: 1,
      padding: "45px",
      overflow: "auto",
      fontSize: "16px",
      lineHeight: "1.5",
      color: ghColors.fg.default,
      wordWrap: "break-word",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
      boxSizing: "border-box",
      
      // Loading state
      "& .markdown-loading, & .markdown-error": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "200px",
        fontSize: "14px",
        color: ghColors.fg.muted
      },
      
      "& .markdown-error": {
        color: "#f85149"
      },
      
      // ========== 标题样式 ==========
      "& h1, & h2, & h3, & h4, & h5, & h6": {
        marginTop: "24px",
        marginBottom: "16px",
        fontWeight: "600",
        lineHeight: "1.25",
        color: ghColors.fg.default
      },
      "& h1": {
        fontSize: "2em",
        borderBottom: `1px solid ${ghColors.border.muted}`,
        paddingBottom: "0.3em"
      },
      "& h2": {
        fontSize: "1.5em",
        borderBottom: `1px solid ${ghColors.border.muted}`,
        paddingBottom: "0.3em"
      },
      "& h3": {
        fontSize: "1.25em"
      },
      "& h4": {
        fontSize: "1em"
      },
      "& h5": {
        fontSize: "0.875em"
      },
      "& h6": {
        fontSize: "0.85em",
        color: ghColors.fg.muted
      },

      // ========== 段落和文本 ==========
      "& p": {
        marginTop: "0",
        marginBottom: "16px"
      },
      "& strong": {
        fontWeight: "600"
      },
      "& em": {
        fontStyle: "italic"
      },
      "& del": {
        textDecoration: "line-through",
        opacity: "0.7"
      },

      // ========== 列表 ==========
      "& ul, & ol": {
        paddingLeft: "2em",
        marginTop: "0",
        marginBottom: "16px"
      },
      "& ul ul, & ul ol, & ol ol, & ol ul": {
        marginTop: "0",
        marginBottom: "0"
      },
      "& li": {
        wordWrap: "break-all"
      },
      "& li > p": {
        marginTop: "16px"
      },
      "& li + li": {
        marginTop: "0.25em"
      },

      // 任务列表
      "& .task-list-item": {
        listStyleType: "none",
        position: "relative",
        paddingLeft: "1.5em"
      },
      "& .task-list-item + .task-list-item": {
        marginTop: "3px"
      },
      "& .task-list-item input[type='checkbox']": {
        font: "inherit",
        overflow: "visible",
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        boxSizing: "border-box",
        padding: "0",
        margin: "0 0.2em 0.25em -1.6em",
        verticalAlign: "middle",
        cursor: "pointer"
      },

      // ========== 代码块 ==========
      "& code, & tt": {
        fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
        fontSize: "85%",
        padding: "0.2em 0.4em",
        margin: "0",
        backgroundColor: isDark ? "rgba(110, 118, 129, 0.4)" : "rgba(27, 31, 35, 0.05)",
        borderRadius: "3px"
      },
      
      "& pre": {
        position: "relative",
        backgroundColor: isDark ? "#161b22" : "#f6f8fa",
        padding: "40px 16px 16px 16px",
        borderRadius: "6px",
        overflow: "auto",
        margin: "16px 0",
        fontSize: "85%",
        lineHeight: "1.45",
        wordWrap: "normal",
        
        // macOS 窗口样式 - 使用伪元素创建顶部栏
        "&::before": {
          content: '""',
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          height: "28px",
          backgroundColor: isDark ? "#1c1c1e" : "#e8e8e8",
          borderBottom: `1px solid ${ghColors.border.default}`,
          borderRadius: "6px 6px 0 0"
        },
        
        // macOS 三个控制按钮
        "&::after": {
          content: '""',
          position: "absolute",
          top: "10px",
          left: "12px",
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          backgroundColor: isDark ? "#ec6a5f" : "#ff5f57",
          boxShadow: `
            18px 0 0 0 ${isDark ? "#f4bf4f" : "#febc2e"},
            36px 0 0 0 ${isDark ? "#61c554" : "#28c840"}
          `
        }
      },
      
      "& pre code, & pre tt": {
        display: "inline",
        maxWidth: "auto",
        padding: "0",
        margin: "0",
        overflow: "visible",
        lineHeight: "inherit",
        wordWrap: "normal",
        backgroundColor: "transparent",
        border: "0",
        fontSize: "100%",
        color: ghColors.fg.default,
        wordBreak: "normal",
        whiteSpace: "pre"
      },

      // ========== 引用块 ==========
      "& blockquote": {
        margin: "16px 0",
        padding: "0 1em",
        color: isDark ? "#7d8590" : "#6a737d",
        borderLeft: isDark ? "0.25em solid #3b434b" : "0.25em solid #dfe2e5"
      },
      "& blockquote > :first-child": {
        marginTop: "0"
      },
      "& blockquote > :last-child": {
        marginBottom: "0"
      },

      // ========== 分割线 ==========
      "& hr": {
        height: "0.25em",
        padding: "0",
        margin: "24px 0",
        backgroundColor: isDark ? "#21262d" : "#e1e4e8",
        border: "0",
        overflow: "hidden",
        boxSizing: "content-box"
      },

      // ========== 表格 ==========
      "& table": {
        borderSpacing: "0",
        borderCollapse: "collapse",
        display: "block",
        width: "100%",
        overflow: "auto",
        marginTop: "0",
        marginBottom: "16px"
      },
      "& table tr": {
        backgroundColor: isDark ? "#0d1117" : "#ffffff",
        borderTop: isDark ? "1px solid #21262d" : "1px solid #c6cbd1"
      },
      "& table th, & table td": {
        padding: "6px 13px",
        border: isDark ? "1px solid #30363d" : "1px solid #dfe2e5"
      },
      "& table th": {
        fontWeight: "600"
      },

      // ========== 链接 ==========
      "& a, & .markdown-link": {
        color: isDark ? "#58a6ff" : "#0366d6",
        textDecoration: "none",
        cursor: "pointer",
        "&:hover": {
          textDecoration: "underline"
        }
      },

      // ========== 图片 ==========
      "& img": {
        maxWidth: "100%",
        height: "auto",
        borderRadius: "4px",
        margin: "16px 0"
      },

      // ========== 其他元素 ==========
      "& kbd": {
        display: "inline-block",
        padding: "3px 5px",
        fontSize: "11px",
        lineHeight: "10px",
        color: ghColors.fg.default,
        verticalAlign: "middle",
        backgroundColor: ghColors.canvas.subtle,
        border: `solid 1px ${isDark ? "rgba(110, 118, 129, 0.4)" : "rgba(175, 184, 193, 0.2)"}`,
        borderBottom: `solid 2px ${isDark ? "rgba(110, 118, 129, 0.4)" : "rgba(175, 184, 193, 0.2)"}`,
        borderRadius: "6px",
        boxShadow: "inset 0 -1px 0 rgba(175, 184, 193, 0.2)"
      },

      // 首个子元素去除上边距
      "& > *:first-child": {
        marginTop: "0 !important"
      },

      // 最后一个子元素去除下边距
      "& > *:last-child": {
        marginBottom: "0 !important"
      }
    }
  }, { dark: colors.dark });
}

