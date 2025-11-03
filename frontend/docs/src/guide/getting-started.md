# Getting Started

Learn the basics of using voidraft and create your first document.

## The Editor Interface

When you open voidraft, you'll see:

- **Main Editor**: The central area where you write and edit
- **Toolbar**: Quick access to common actions
- **Status Bar**: Shows current block language and other info

## Creating Code Blocks

voidraft uses a block-based editing system. Each block can have a different language:

1. Press `Ctrl+Enter` to create a new block
2. Type `∞∞∞` followed by a language name (e.g., `∞∞∞javascript`)
3. Start coding in that block

### Supported Languages

voidraft supports 30+ programming languages including:
- JavaScript, TypeScript
- Python, Go, Rust
- HTML, CSS, Sass
- SQL, YAML, JSON
- And many more...

## Basic Operations

### Navigation

- `Ctrl+Up/Down`: Move between blocks
- `Ctrl+Home/End`: Jump to first/last block
- `Ctrl+F`: Search within document

### Editing

- `Ctrl+D`: Duplicate current line
- `Ctrl+/`: Toggle comment
- `Alt+Up/Down`: Move line up/down
- `Ctrl+Shift+F`: Format code (if language supports Prettier)

### Block Management

- `Ctrl+Enter`: Create new block
- `Ctrl+Shift+Enter`: Create block above
- `Alt+Delete`: Delete current block

## Using the HTTP Client

voidraft includes a built-in HTTP client for testing APIs:

1. Create a block with HTTP language
2. Write your HTTP request:

```http
POST "https://api.example.com/users" {
  content-type: "application/json"
  
  @json {
    name: "John Doe",
    email: "john@example.com"
  }
}
```

3. Click the run button to execute the request
4. View the response inline

## Multi-Window Support

Work on multiple documents simultaneously:

1. Go to `File > New Window` (or `Ctrl+Shift+N`)
2. Each window is independent
3. Changes are saved automatically

## Customizing Themes

Personalize your editor:

1. Open Settings (`Ctrl+,`)
2. Go to Appearance
3. Choose a theme or create your own
4. Customize colors to your preference

## Keyboard Shortcuts

Learn essential shortcuts:

| Action | Shortcut |
|--------|----------|
| New Window | `Ctrl+Shift+N` |
| Search | `Ctrl+F` |
| Replace | `Ctrl+H` |
| Format Code | `Ctrl+Shift+F` |
| Toggle Theme | `Ctrl+Shift+T` |
| Command Palette | `Ctrl+Shift+P` |

## Next Steps

Now that you know the basics:

- Explore [Features](/guide/features) in detail
- Set up [Git Backup](/guide/backup) for your data
- Learn about [Extensions](/guide/extensions)
- Configure [Settings](/guide/settings)

