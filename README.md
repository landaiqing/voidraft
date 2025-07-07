# <img src="./frontend/public/appicon.png" alt="VoidRaft Logo" width="32" height="32" style="vertical-align: middle;"> VoidRaft

[中文](README_ZH.md) | **English**

> *An elegant text snippet recording tool designed for developers.*

VoidRaft is a modern developer-focused text editor that allows you to record, organize, and manage various text snippets anytime, anywhere. Whether it's temporary code snippets, API responses, meeting notes, or daily to-do lists, VoidRaft provides a smooth and elegant editing experience.

## Core Features

### Developer-Friendly

- Multi-language code block support - Syntax highlighting for 30+ programming languages
- Smart language detection - Automatically recognizes code block language types
- Code formatting - Built-in Prettier support for one-click code beautification
- Block editing mode - Split content into independent code blocks, each with different language settings

### Modern Interface

- Clean and elegant design - Simple yet sophisticated user interface
- Dark/Light themes - Adapts to different usage scenarios
- Multi-language support - Built-in internationalization with multiple language switching

### Extension System

- Modular architecture - Extensible editor based on CodeMirror 6
- Rich extensions - Includes various practical editor extensions
  - Rainbow bracket matching
  - VSCode-style search and replace
  - Color picker
  - Built-in translation tool
  - Text highlighting
  - Code folding
  - Hyperlink support
  - Checkbox support
  - Minimap

## Quick Start

### Download and Use

1. Visit the releases page: https://github.com/landaiqing/voidraft/releases
2. Select and download the appropriate version
3. Run the installer and start using

### Development Environment

```bash
# Clone the project
git clone https://github.com/landaiqing/voidraft
cd voidraft

# Install frontend dependencies
cd frontend
npm install
cd ..

# Start development server
wails3 dev
```

### Production Build

```bash
# Build application
wails3 package
```

After building, the executable will be generated in the `bin` directory.

## Technical Architecture

### Core Technologies

| Layer | Technology Stack |
|-------|------------------|
| Desktop Framework | Wails3 |
| Backend Language | Go 1.21+ |
| Frontend Framework | Vue 3 + TypeScript |
| Editor Core | CodeMirror 6 |
| Build Tool | Vite |
| Data Storage | SQLite |

## Project Structure

```
Voidraft/
├── frontend/              # Vue 3 frontend application
│   ├── src/
│   │   ├── views/editor/  # Editor core views
│   │   │   ├── extensions/ # Editor extension system
│   │   │   │   ├── codeblock/    # Code block support
│   │   │   │   ├── translator/   # Translation tool
│   │   │   │   ├── minimap/     # Code minimap
│   │   │   │   ├── vscodeSearch/ # VSCode-style search
│   │   │   │   └── ...           # More extensions
│   │   │   └── ...
│   │   ├── components/    # Reusable components
│   │   ├── stores/       # Pinia state management
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
├── internal/             # Go backend core
│   ├── services/          # Core business services
│   ├── models/            # Data model definitions
│   └── events/            # Event handling mechanisms
└── main.go               # Application entry point
```

## Development Roadmap

### Platform Extension Plans

| Platform | Status | Expected Time |
|----------|--------|---------------|
| macOS | Planned | Future versions |
| Linux | Planned | Future versions |

### Planned Features
- [ ] Custom themes - Customize editor themes
- [ ] Multi-window support - Support editing multiple documents simultaneously
- [ ] Enhanced clipboard - Monitor and manage clipboard history
  - Automatic text content saving
  - Image content support
  - History management
- [ ] Data synchronization - Cloud backup for configurations and documents
- [ ] Extension system - Support for custom plugins

## Acknowledgments

> Standing on the shoulders of giants, paying tribute to the open source spirit

The birth of VoidRaft is inseparable from the following excellent open source projects:

### Special Thanks

- **[Heynote](https://github.com/heyman/heynote/)** - VoidRaft is a feature-enhanced version based on Heynote's concept
  - Inherits Heynote's elegant block editing philosophy
  - Adds more practical features on the original foundation
  - Rebuilt with modern technology stack
  - Provides richer extension system and customization options
  - Thanks to the Heynote team for bringing innovative ideas to the developer community

### Core Technology Stack

| Technology | Purpose | Link |
|------------|---------|------|
| Wails3 | Cross-platform desktop application framework | [wails.io](https://v3alpha.wails.io/) |
| Vue.js | Progressive frontend framework | [vuejs.org](https://vuejs.org/) |
| CodeMirror 6 | Modern code editor | [codemirror.net](https://codemirror.net/) |
| Prettier | Code formatting tool | [prettier.io](https://prettier.io/) |
| TypeScript | Type-safe JavaScript | [typescriptlang.org](https://www.typescriptlang.org/) |

## License

This project is open source under the [MIT License](LICENSE).

Welcome to Fork, Star, and contribute code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/landaiqing/Voidraft.svg?style=social&label=Star)](https://github.com/yourusername/Voidraft)
[![GitHub forks](https://img.shields.io/github/forks/landaiqing/Voidraft.svg?style=social&label=Fork)](https://github.com/yourusername/Voidraft)

*Made with ❤️ by landaiqing*