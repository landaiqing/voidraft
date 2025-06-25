export default {
  titlebar: {
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore Down',
    close: 'Close'
  },
  toolbar: {
    editor: {
      lines: 'Ln',
      characters: 'Ch',
      selected: 'Sel'
    },
    fontSizeTooltip: 'Font Size (Ctrl+wheel to adjust)',
    settings: 'Settings',
    alwaysOnTop: 'Always on Top',
    blockLanguage: 'Block Language',
    searchLanguage: 'Search language...',
    noLanguageFound: 'No language found',
    formatHint: 'Current block supports formatting, use Ctrl+Shift+F shortcut for formatting',
  },
  languages: {
    'zh-CN': 'Chinese',
    'en-US': 'English'
  },
  systemTheme: {
    dark: 'Dark',
    light: 'Light',
    auto: 'Follow System'
  },
  keybindings: {
    headers: {
      shortcut: 'Shortcut',
      category: 'Category',
      description: 'Description'
    },
    commands: {
      showSearch: 'Show search panel',
      hideSearch: 'Hide search panel',
      searchToggleCase: 'Toggle case-sensitive matching',
      searchToggleWord: 'Toggle whole word matching',
      searchToggleRegex: 'Toggle regular expression matching',
      searchShowReplace: 'Show replace functionality',
      searchReplaceAll: 'Replace all matches',
      blockSelectAll: 'Select all in block',
      blockAddAfterCurrent: 'Add new block after current',
      blockAddAfterLast: 'Add new block at end',
      blockAddBeforeCurrent: 'Add new block before current',
      blockGotoPrevious: 'Go to previous block',
      blockGotoNext: 'Go to next block',
      blockSelectPrevious: 'Select previous block',
      blockSelectNext: 'Select next block',
      blockDelete: 'Delete current block',
      blockMoveUp: 'Move current block up',
      blockMoveDown: 'Move current block down',
      blockDeleteLine: 'Delete line',
      blockMoveLineUp: 'Move line up',
      blockMoveLineDown: 'Move line down',
      blockTransposeChars: 'Transpose characters',
      blockFormat: 'Format code block',
      blockCopy: 'Copy',
      blockCut: 'Cut',
      blockPaste: 'Paste',
      historyUndo: 'Undo',
      historyRedo: 'Redo',
      historyUndoSelection: 'Undo selection',
      historyRedoSelection: 'Redo selection',
      foldCode: 'Fold code',
      unfoldCode: 'Unfold code',
      foldAll: 'Fold all',
      unfoldAll: 'Unfold all',
      cursorSyntaxLeft: 'Cursor syntax left',
      cursorSyntaxRight: 'Cursor syntax right',
      selectSyntaxLeft: 'Select syntax left',
      selectSyntaxRight: 'Select syntax right',
      copyLineUp: 'Copy line up',
      copyLineDown: 'Copy line down',
      insertBlankLine: 'Insert blank line',
      selectLine: 'Select line',
      selectParentSyntax: 'Select parent syntax',
      indentLess: 'Indent less',
      indentMore: 'Indent more',
      indentSelection: 'Indent selection',
      cursorMatchingBracket: 'Cursor matching bracket',
      toggleComment: 'Toggle comment',
      toggleBlockComment: 'Toggle block comment',
      insertNewlineAndIndent: 'Insert newline and indent',
      deleteCharBackward: 'Delete character backward',
      deleteCharForward: 'Delete character forward',
      deleteGroupBackward: 'Delete group backward',
      deleteGroupForward: 'Delete group forward',
    }
  },
  settings: {
    title: 'Settings',
    backToEditor: 'Back to Editor',
    systemInfo: 'System Info',
    general: 'General',
    editing: 'Editor',
    appearance: 'Appearance',
    keyBindings: 'Key Bindings',
    updates: 'Updates',
    reset: 'Reset',
    dangerZone: 'Danger Zone',
    resetAllSettings: 'Reset All Settings',
    confirmReset: 'Click again to confirm reset',
    globalHotkey: 'Global Keyboard Shortcuts',
    enableGlobalHotkey: 'Enable Global Hotkeys',
    window: 'Window/Application',
    showInSystemTray: 'Show in System Tray',
    enableSystemTray: 'Enable System Tray',
    alwaysOnTop: 'Always on Top',
    startup: 'Startup Settings',
    startAtLogin: 'Start at Login',
    dataStorage: 'Data Storage',
    dataPath: 'Data Storage Path',
    clickToSelectPath: 'Click to select path',
    resetDefault: 'Reset Default',
    resetToDefaultPath: 'Reset to default path',
    fontSize: 'Font Size',
    fontSizeDescription: 'Editor font size',
    fontSettings: 'Font Settings',
    fontFamily: 'Font Family',
    fontFamilyDescription: 'Choose editor font family',
    fontWeight: 'Font Weight',
    fontWeightDescription: 'Set the thickness of the font',
    lineHeight: 'Line Height',
    lineHeightDescription: 'Set the spacing between text lines',
    tabSettings: 'Tab Settings',
    tabSize: 'Tab Size',
    tabType: 'Tab Type',
    spaces: 'Spaces',
    tabs: 'Tabs',
    enableTabIndent: 'Enable Tab Indent',
    language: 'Interface Language',
    systemTheme: 'System Theme',
    saveOptions: 'Save Options',
    autoSaveDelay: 'Auto Save Delay (ms)',
    updateSettings: 'Update Settings',
    autoCheckUpdates: 'Auto Check Updates',
    autoCheckUpdatesDescription: 'Automatically check for updates on startup',
    manualCheck: 'Manual Check',
    currentVersion: 'Current Version',
    checkForUpdates: 'Check for Updates',
    checking: 'Checking...',
    checkFailed: 'Check Failed',
    newVersionAvailable: 'New Version Available',
    upToDate: 'You are using the latest version',
    viewUpdate: 'View Update',
    releaseNotes: 'Release Notes',
    networkError: 'Network connection error, please check your network settings',
    extensions: 'Extensions',
    extensionsPage: {
      loading: 'Loading',
      categoryEditing: 'Editing Enhancement',
      categoryUI: 'UI Enhancement',
      categoryTools: 'Tools',
      configuration: 'Configuration',
      resetToDefault: 'Reset to Default Configuration',
      // Keep necessary extension interface translations, configuration items display in English directly
    }
  },
  extensions: {
    rainbowBrackets: {
      name: 'Rainbow Brackets',
      description: 'Display nested brackets in different colors'
    },
    hyperlink: {
      name: 'Hyperlink',
      description: 'Recognize and make hyperlinks clickable'
    },
    colorSelector: {
      name: 'Color Selector',
      description: 'Visual color picker and color value display'
    },
    minimap: {
      name: 'Minimap',
      description: 'Display minimap overview of the document'
    },

    search: {
      name: 'Search',
      description: 'Text search and replace functionality'
    },
    codeBlock: {
      name: 'Code Block',
      description: 'Code block syntax highlighting and formatting'
    },
    fold: {
      name: 'Code Folding',
      description: 'Collapse and expand code sections for better readability'
    },
    textHighlight: {
      name: 'Text Highlight',
      description: 'Highlight text selections and search matches'
    }
  }
}; 