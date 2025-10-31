# wdidt - What Did I Do Today

A personal CLI tool for managing daily notes with todos, useful information, and scratch notes.

## Features

- **Daily Notes**: Automatically creates dated sections for each day
- **Todo Management**: Add, toggle, edit, and delete todos with an interactive interface
- **References**: Save commands, snippets, and useful info with unique 3-word identifiers for easy searching
- **Quick Notes**: Jot down random thoughts and scratch notes
- **Custom Directory**: Choose where to save your notes on first run
- **Markdown Format**: All notes saved in a clean markdown format

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

### Add a Todo
```bash
wdidt add "Buy groceries"
```
or without text to be prompted:
```bash
wdidt add
```
Adds a new todo item for today. If you provide text after the command, it will be added directly. Otherwise, you'll be prompted to enter the todo.

#### Adding Context to Todos

You can add context/notes to any todo to provide additional details:

**Option 1: Add context via flag**
```bash
wdidt add "Deploy to production" --context "Make sure to backup database first"
```

**Option 2: Add context when prompted**
After adding a todo, you'll be asked if you want to add context.

**Option 3: Add context later**
Use `wdidt todos` to select a todo and add context to it later.

### Manage Todos (View, Toggle, Edit, Delete, Context)
```bash
wdidt todos
```
Interactive todo management:
1. **Toggle todos**: Use checkboxes to mark todos as complete/incomplete (space to toggle, enter to continue)
2. **Edit or delete**: Select any todo to:
   - Edit the todo text
   - Delete the todo entirely
   - **View context**: See the context/notes for a todo (shown with 📎 icon)
   - **Add context**: Add context to a todo that doesn't have one
   - **Edit context**: Update existing context
   - **Delete context**: Remove context from a todo

### Save a Reference
```bash
wdidt ref "curl -X POST https://api.example.com/endpoint"
```
or without text to be prompted:
```bash
wdidt ref
```
Saves a reference with a unique 3-word identifier (e.g., "quick-runs-fox"). Perfect for commands, snippets, or any information you want to easily find later by searching for the identifier.

### Add a Quick Note
```bash
wdidt note "remember to check on that deployment"
```
or without text to be prompted:
```bash
wdidt note
```
Adds a quick note or random thought to your daily notes.

## Notes Format

Notes are organized by month in separate files (e.g., `2024-10-notes.md`). Each monthly file contains:

```markdown
# October 2024

## Thursday, October 31, 2024

### Todos

- [ ] Deploy to production [context: calm-thinks-moon]
- [x] Update documentation
- [ ] Review pull requests

### Context

**[calm-thinks-moon]**
Make sure to backup database first and notify the team

### References

#ref [quick-runs-fox]
curl -X POST https://api.example.com/endpoint
#/ref

#ref [bright-thinks-star]
docker ps --format 'table {{.Names}}\t{{.Status}}'
#/ref

### Notes

remember to check on that deployment

random thought about the project architecture

## Friday, November 1, 2024

### Todos
...
```

**File Structure:**
- `#` = Month and year header (October 2024)
- `##` = Daily entries (Thursday, October 31, 2024)
- `###` = Sections (Todos, Context, References, Notes)

**Monthly Files:**
When a new month starts, a new file is automatically created (e.g., `2024-11-notes.md`). This keeps your notes organized and prevents any single file from becoming too large.

Todos can reference context using unique 3-word identifiers (e.g., `[context: calm-thinks-moon]`). The context details are stored in the Context section, keeping your todos clean while maintaining detailed information.

## Confluence Sync

Sync your daily notes to Confluence for easy sharing and collaboration.

### Setup Confluence Sync

**First-time setup:**
During initial configuration, you'll be asked if you want to sync to Confluence.

**Configure later:**
```bash
wdidt confluence
```

**Steps:**
1. Create a Confluence API token at: https://id.atlassian.com/manage-profile/security/api-tokens
2. Run `wdidt confluence` and provide:
   - Confluence URL (e.g., https://yourcompany.atlassian.net)
   - Your email
   - API token
   - Space key where notes will be synced
   - (Optional) Parent page ID

### Sync Notes

```bash
wdidt sync
```

This will:
- Convert all monthly notes files to Confluence format
- Create new pages or update existing ones
- Maintain your notes structure in Confluence
- Show a summary of created/updated pages

**Page naming:** Files are synced as "Daily Notes - Month Year" (e.g., "Daily Notes - October 2025")

## TypeScript Support

All files include JSDoc comments for IDE type checking and IntelliSense support.

## Configuration

Configuration is stored in `~/.wdidt/config.json`. The notes directory path and Confluence settings can be changed by editing this file or running the respective configuration commands.
