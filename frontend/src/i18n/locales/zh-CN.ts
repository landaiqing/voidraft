export default {
  locale: 'zh-CN',
  titlebar: {
    minimize: '最小化',
    maximize: '最大化',
    restore: '向下还原',
    close: '关闭'
  },
  toolbar: {
    editor: {
      lines: 'Ln',
      characters: 'Ch',
      selected: 'Sel'
    },
    fontSizeTooltip: '字体大小 (Ctrl+滚轮调整)',
    settings: '设置',
    alwaysOnTop: '窗口置顶',
    blockLanguage: '块语言',
    searchLanguage: '搜索语言...',
    noLanguageFound: '未找到匹配的语言',
    formatHint: '点击格式化区块（Ctrl+Shift+F）',
    // 文档选择器
    selectDocument: '选择文档',
    searchOrCreateDocument: '搜索或输入新文档名...',
    createDocument: '创建',
    noDocumentFound: '没有找到文档',
    loading: '加载中...',
    rename: '重命名',
    delete: '删除',
    confirm: '确认',
    confirmDelete: '再次点击确认删除',
    documentNameTooLong: '文档名称不能超过{max}个字符',
    documentNameRequired: '文档名称不能为空',
    cannotDeleteLastDocument: '无法删除最后一个文档',
    cannotDeleteDefaultDocument: '无法删除默认文档',
    unknownTime: '未知时间',
    invalidDate: '无效日期',
    timeError: '时间错误',
  },
  languages: {
    'zh-CN': '简体中文',
    'en-US': 'English'
  },
  systemTheme: {
    dark: '深色',
    light: '浅色',
    auto: '跟随系统'
  },
  keybindings: {
    headers: {
      shortcut: '快捷键',
      category: '分类',
      description: '描述'
    },
    commands: {
      showSearch: '显示搜索面板',
      hideSearch: '隐藏搜索面板',
      searchToggleCase: '切换大小写敏感匹配',
      searchToggleWord: '切换整词匹配',
      searchToggleRegex: '切换正则表达式匹配',
      searchShowReplace: '显示替换功能',
      searchReplaceAll: '替换全部匹配项',
      blockSelectAll: '块内选择全部',
      blockAddAfterCurrent: '在当前块后添加新块',
      blockAddAfterLast: '在最后添加新块',
      blockAddBeforeCurrent: '在当前块前添加新块',
      blockGotoPrevious: '跳转到上一个块',
      blockGotoNext: '跳转到下一个块',
      blockSelectPrevious: '选择上一个块',
      blockSelectNext: '选择下一个块',
      blockDelete: '删除当前块',
      blockMoveUp: '向上移动当前块',
      blockMoveDown: '向下移动当前块',
      blockDeleteLine: '删除行',
      blockMoveLineUp: '向上移动行',
      blockMoveLineDown: '向下移动行',
      blockTransposeChars: '字符转置',
      blockFormat: '格式化代码块',
      blockCopy: '复制',
      blockCut: '剪切',
      blockPaste: '粘贴',
      historyUndo: '撤销',
      historyRedo: '重做',
      historyUndoSelection: '撤销选择',
      historyRedoSelection: '重做选择',
      foldCode: '折叠代码',
      unfoldCode: '展开代码',
      foldAll: '折叠全部',
      unfoldAll: '展开全部',
      cursorSyntaxLeft: '光标按语法左移',
      cursorSyntaxRight: '光标按语法右移',
      selectSyntaxLeft: '按语法选择左侧',
      selectSyntaxRight: '按语法选择右侧',
      copyLineUp: '向上复制行',
      copyLineDown: '向下复制行',
      insertBlankLine: '插入空行',
      selectLine: '选择行',
      selectParentSyntax: '选择父级语法',
      indentLess: '减少缩进',
      indentMore: '增加缩进',
      indentSelection: '缩进选择',
      cursorMatchingBracket: '光标到匹配括号',
      toggleComment: '切换注释',
      toggleBlockComment: '切换块注释',
      insertNewlineAndIndent: '插入新行并缩进',
      deleteCharBackward: '向后删除字符',
      deleteCharForward: '向前删除字符',
      deleteGroupBackward: '向后删除组',
      deleteGroupForward: '向前删除组',
    textHighlightToggle: '切换文本高亮',
    }
  },
  settings: {
    title: '设置',
    backToEditor: '返回编辑器',
    systemInfo: '系统信息',
    general: '常规',
    editing: '编辑器',
    appearance: '外观',
    extensions: '扩展',
    keyBindings: '快捷键',
    updates: '更新',
    reset: '重置',
    dangerZone: '危险操作',
    resetAllSettings: '重置所有设置',
    confirmReset: '再次点击确认重置',
    globalHotkey: '全局键盘快捷键',
    enableGlobalHotkey: '启用全局热键',
    window: '窗口/应用程序',
    showInSystemTray: '在系统托盘中显示',
    enableSystemTray: '启用系统托盘',
    alwaysOnTop: '窗口始终置顶',
    startup: '启动设置',
    startAtLogin: '开机自启动',
    dataStorage: '数据存储',
    dataPath: '数据存储路径',
    clickToSelectPath: '点击选择路径',
    resetDefault: '恢复默认',
    resetToDefaultPath: '恢复为默认路径',
    fontSize: '字体大小',
    fontSizeDescription: '编辑器字体大小',
    fontSettings: '字体设置',
    fontFamily: '字体',
    fontFamilyDescription: '选择编辑器字体',
    fontWeight: '字体粗细',
    fontWeightDescription: '设置字体的粗细程度',
    lineHeight: '行高',
    lineHeightDescription: '设置文本行之间的间距',
    tabSettings: 'Tab 设置',
    tabSize: 'Tab 大小',
    tabType: 'Tab 类型',
    spaces: '空格',
    tabs: '制表符',
    enableTabIndent: '启用 Tab 缩进',
    language: '界面语言',
    systemTheme: '系统主题',
    saveOptions: '保存选项',
    autoSaveDelay: '自动保存延迟(毫秒)',
    updateSettings: '更新设置',
    autoCheckUpdates: '自动检查更新',
    autoCheckUpdatesDescription: '应用启动时自动检查更新',
    manualCheck: '手动更新',
    currentVersion: '当前版本',
    checkForUpdates: '检查更新',
    checking: '正在检查...',
    checkFailed: '检查失败',
    newVersionAvailable: '发现新版本',
    upToDate: '已是最新版本',
    viewUpdate: '查看更新',
    releaseNotes: '更新日志',
    networkError: '网络连接错误，请检查网络设置',
    updateNow: '立即更新',
    updating: '正在更新...',
    updateSuccess: '更新成功',
    updateSuccessRestartRequired: '更新已成功应用，请重启应用以生效',
    updateSuccessNoRestart: '更新已完成，无需重启',
    restartNow: '立即重启',
    extensionsPage: {
      loading: '加载中',
      categoryEditing: '编辑增强',
      categoryUI: '界面增强',
      categoryTools: '工具扩展',
      configuration: '配置',
      resetToDefault: '重置为默认配置',
      // 保留必要的扩展界面翻译，配置项直接显示英文
    }
  },
  extensions: {
    rainbowBrackets: {
      name: '彩虹括号',
      description: '用不同颜色显示嵌套括号'
    },
    hyperlink: {
      name: '超链接',
      description: '识别并可点击超链接'
    },
    colorSelector: {
      name: '颜色选择器',
      description: '颜色值的可视化和选择'
    },
    minimap: {
      name: '小地图',
      description: '显示小地图视图'
    },
    search: {
      name: '搜索功能',
      description: '文本搜索和替换功能'
    },
    fold: {
      name: '代码折叠',
      description: '折叠和展开代码段以提高代码可读性'
    },
    textHighlight: {
      name: '文本高亮',
      description: '高亮选中的文本内容 (Ctrl+Shift+H 切换高亮)',
      backgroundColor: '背景颜色',
      opacity: '透明度'
    },
    checkbox: {
      name: '选择框',
      description: '将 [x] 和 [ ] 渲染为可交互的选择框'
    },
    codeblock: {
      name: '代码块',
      description: '代码块相关功能'
    }
  },
  monitor: {
    memory: '内存',
    clickToClean: '点击清理内存'
  }
}; 