# Features

Explore the powerful features that make voidraft a great tool for developers.

## Block-Based Editing

voidraft's core feature is its block-based editing system:

- Each block can have a different programming language
- Blocks are separated by delimiters (`∞∞∞language`)
- Navigate quickly between blocks
- Format each block independently

## Syntax Highlighting

Professional syntax highlighting for 30+ languages:

- Automatic language detection
- Customizable color schemes
- Support for nested languages
- Code folding support

## HTTP Client

Built-in HTTP client for API testing:

### Request Types
- GET, POST, PUT, DELETE, PATCH
- Custom headers
- Multiple body formats: JSON, FormData, URL-encoded, XML, Text

### Request Variables
Define and reuse variables:

```http
@var {
  baseUrl: "https://api.example.com",
  token: "your-api-token"
}

GET "{{baseUrl}}/users" {
  authorization: "Bearer {{token}}"
}
```

### Response Handling
- View formatted JSON responses
- See response time and size
- Inspect headers
- Save responses for later

## Code Formatting

Integrated Prettier support:

- Format on save (optional)
- Format selection or entire block
- Supports JavaScript, TypeScript, CSS, HTML, JSON, and more
- Customizable formatting rules

## Editor Extensions

### VSCode-Style Search
- Find and replace with regex support
- Case-sensitive and whole word options
- Search across all blocks

### Minimap
- Bird's-eye view of your document
- Quick navigation
- Customizable size and position

### Rainbow Brackets
- Color-coded bracket pairs
- Easier to match brackets
- Customizable colors

### Color Picker
- Visual color selection
- Supports hex, RGB, HSL
- Live preview

### Translation Tool
- Translate selected text
- Multiple language support
- Quick keyboard access

### Text Highlighting
- Highlight important text
- Multiple highlight colors
- Persistent highlights

## Multi-Window Support

Work efficiently with multiple windows:

- Each window is independent
- Separate documents
- Synchronized settings
- Window state persistence

## Theme Customization

Full control over editor appearance:

### Built-in Themes
- Dark mode
- Light mode
- Auto-switch based on system

### Custom Themes
- Create your own themes
- Customize every color
- Save and share themes
- Import community themes

## Auto-Update System

Stay current with automatic updates:

- Background update checks
- Notification of new versions
- One-click update
- Update history
- Support for multiple update sources (GitHub, Gitea)

## Data Backup

Secure your data with Git-based backup:

- Automatic backups
- Manual backup triggers
- Support for GitHub and Gitea
- Multiple authentication methods (SSH, Token, Password)
- Configurable backup intervals

## Keyboard Shortcuts

Extensive keyboard support:

- Customizable shortcuts
- Vim/Emacs keybindings (planned)
- Quick command palette
- Context-aware shortcuts

## Performance

Built for speed:

- Fast startup time
- Smooth scrolling
- Efficient memory usage
- Large file support

## Privacy & Security

Your data is safe:

- Local-first storage
- Optional cloud backup
- No telemetry or tracking
- Open source codebase

