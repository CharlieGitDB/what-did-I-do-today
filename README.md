# wdidt - What Did I Do Today

A personal CLI tool for managing daily notes with todos, references, and notes. Features interactive vim-style management and optional Confluence sync.

## Features

- **Daily Notes**: Automatically creates dated sections for each day (sorted by most recent)
- **Interactive Todo Management**: Add, toggle, edit, and delete todos with vim-style navigation
- **Interactive Notes Management**: Add, view, edit, and delete notes with timestamps
- **Interactive References Management**: Add, view, edit, and delete references with unique IDs
- **Context Support**: Add detailed context to any todo item
- **Confluence Sync**: Optional automatic or manual sync to Confluence with silent mode
- **HTML/XHTML Format**: Notes stored in Confluence-compatible format
- **Custom Directory**: Choose where to save your notes

## Installation

1. Install dependencies:
```bash
npm install
```

2. Link the CLI globally:
```bash
npm link
```

3. On first run, you'll be prompted to choose where to save your notes.

## Usage

### Todo Management

**Quick add a todo:**
```bash
wdidt todo "Deploy to production"
```

**Add todo with context:**
```bash
wdidt todo "Deploy to production" "Backup database first"
# or
wdidt todo "Deploy to production" --context "Backup database first"
```

**Interactive todo manager:**
```bash
wdidt todo
# or
wdidt todos    # legacy alias
```

Interactive controls:
- `j/k` or `↑/↓` - Navigate
- `SPACE` - Toggle complete/incomplete
- `e` - Edit todo text
- `d` - Delete todo
- `c` - Manage context (view/add/edit/delete)
- `a` - Add new todo
- `ESC` - Exit

### Notes Management

**Quick add a note:**
```bash
wdidt note "Remember to check the deployment logs"
```

**Interactive notes manager:**
```bash
wdidt note
# or
wdidt notes    # legacy alias
```

Interactive controls:
- `j/k` or `↑/↓` - Navigate
- `e` - Edit note
- `d` - Delete note
- `a` - Add new note
- `ESC` - Exit

Notes include timestamps (e.g., "2:30 PM") for tracking when they were added.

### References Management

**Quick add a reference:**
```bash
wdidt ref "curl -X POST https://api.example.com/endpoint"
```

**Interactive references manager:**
```bash
wdidt ref
# or
wdidt refs    # legacy alias
```

Interactive controls:
- `j/k` or `↑/↓` - Navigate
- `v` - View full reference content
- `e` - Edit reference
- `d` - Delete reference
- `a` - Add new reference
- `ESC` - Exit

References are assigned unique numeric IDs (e.g., `[1]`, `[2]`) and include timestamps.

## Notes Format

Notes are organized by month in HTML files (e.g., `2025-11-notes.html`). Files use Confluence XHTML format:

```html
<h2>Monday, November 3, 2025</h2>

<h3>Todos</h3>
<ac:task-list>
<ac:task><ac:task-id>1</ac:task-id><ac:task-status>incomplete</ac:task-status><ac:task-body><span class="placeholder-inline-tasks">Deploy to production</span></ac:task-body></ac:task>
<ac:task><ac:task-id>2</ac:task-id><ac:task-status>complete</ac:task-status><ac:task-body><span class="placeholder-inline-tasks">Update documentation</span></ac:task-body></ac:task>
</ac:task-list>

<h3>Context</h3>
<ac:structured-macro ac:name="info">
<ac:parameter ac:name="title">Context for Todo #1</ac:parameter>
<ac:rich-text-body>
<p>Backup database first and notify the team</p>
</ac:rich-text-body>
</ac:structured-macro>

<h3>References</h3>
<p style="color: #888; font-size: 0.85em; margin-bottom: 5px;">2:30 PM</p>
<p><strong>[1]</strong> curl -X POST https://api.example.com/endpoint</p>

<h3>Notes</h3>
<p style="color: #888; font-size: 0.85em; margin-bottom: 5px;">2:30 PM</p>
<p>Remember to check the deployment logs</p>

<hr>

<h2>Sunday, November 2, 2025</h2>
...
```

**File Organization:**
- Monthly files: `YYYY-MM-notes.html` (e.g., `2025-11-notes.html`)
- Most recent date appears first
- Days separated by `<hr>` horizontal rules
- New month = new file automatically

## Confluence Sync

Sync your daily notes to Confluence for easy sharing and collaboration.

### Setup Confluence Sync

**Configure Confluence:**
```bash
wdidt confluence
```

**Required information:**
1. Create a Confluence API token at: https://id.atlassian.com/manage-profile/security/api-tokens
2. Provide:
   - Confluence URL (e.g., https://yourcompany.atlassian.net)
   - Your email
   - API token
   - Space key where notes will be synced
   - (Optional) Parent page ID
   - Silent sync preference (yes = background sync, no = verbose output)

### Sync Notes

**Manual sync:**
```bash
wdidt sync
```

**Auto-sync:**
Auto-sync runs automatically after these commands (if enabled):
- `wdidt todo "text"`
- `wdidt note "text"`
- `wdidt ref "text"`
- Exiting interactive managers (`wdidt todo`, `wdidt note`, `wdidt ref`)

**Silent sync mode:**
If enabled in configuration, syncs happen silently in the background. Otherwise, shows detailed output with created/updated page counts.

**Page naming:** Pages appear in Confluence as "Month YYYY" (e.g., "November 2025")

### Test Confluence Connection

```bash
wdidt test-confluence
wdidt test-confluence --debug    # Show auth details
```

Tests authentication and space access to verify your configuration.

## Configuration

Configuration is stored in `~/.wdidt/config.json`:

```json
{
  "notesDirectory": "C:\\Users\\username\\Documents\\daily-notes",
  "confluence": {
    "enabled": true,
    "baseUrl": "https://yourcompany.atlassian.net",
    "email": "you@example.com",
    "apiToken": "your-api-token",
    "spaceKey": "YOURSPACE",
    "parentPageId": "123456789",
    "silentSync": false
  }
}
```

**Important:** The config file contains sensitive data (API tokens) and is automatically excluded from git.

## Command Reference

| Command | Description |
|---------|-------------|
| `wdidt todo [text]` | Add todo (or open interactive manager) |
| `wdidt note [text]` | Add note (or open interactive manager) |
| `wdidt ref [text]` | Add reference (or open interactive manager) |
| `wdidt confluence` | Configure Confluence sync settings |
| `wdidt sync` | Manually sync notes to Confluence |
| `wdidt test-confluence` | Test Confluence connection |
| `wdidt todos` | Alias for `wdidt todo` |
| `wdidt notes` | Alias for `wdidt note` |
| `wdidt refs` | Alias for `wdidt ref` |

## TypeScript Support

All files include JSDoc comments for IDE type checking and IntelliSense support.

## Security

- Config file (`~/.wdidt/config.json`) is stored outside the repository
- SSH keys (`.git/ssh/`) are git-ignored
- Sensitive data is never committed to version control
