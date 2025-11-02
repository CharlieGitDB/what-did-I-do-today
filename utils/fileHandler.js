import fs from 'fs';
import path from 'path';
import { getConfig } from './config.js';
import { glob } from 'glob';

/**
 * @typedef {Object} TodoItem
 * @property {boolean} checked - Whether the todo is checked
 * @property {string} text - The todo text
 * @property {number} lineNumber - The line number in the section
 * @property {string[]} contextIds - Array of context IDs linked to this todo
 */

/**
 * @typedef {Object} TodaySection
 * @property {number} startIdx - Starting line index
 * @property {number} endIdx - Ending line index
 * @property {string} content - The section content
 */

/**
 * Gets the current month in YYYY-MM format
 * @returns {string} Current month string
 */
export function getCurrentMonthString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Gets the month and year display string (e.g., "October 2024")
 * @returns {string} Month and year display string
 */
export function getMonthYearDisplay() {
  const today = new Date();
  const options = { year: 'numeric', month: 'long' };
  return today.toLocaleDateString('en-US', options);
}

/**
 * Gets the path to the notes file for the current month
 * @returns {Promise<string>} The path to the current month's notes file
 */
export async function getNotesFilePath() {
  const config = await getConfig();
  const monthString = getCurrentMonthString();
  return path.join(config.notesDirectory, `${monthString}-notes.html`);
}

/**
 * Ensures the notes directory exists
 * @returns {Promise<void>}
 */
export async function ensureNotesDir() {
  const config = await getConfig();
  if (!fs.existsSync(config.notesDirectory)) {
    fs.mkdirSync(config.notesDirectory, { recursive: true });
  }
}

/**
 * Gets today's date as a formatted string
 * @returns {string} Today's date in long format
 */
export function getTodayString() {
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return today.toLocaleDateString('en-US', options);
}

/**
 * Reads the notes file for the current month
 * @returns {Promise<string>} The content of the notes file
 */
export async function readNotesFile() {
  await ensureNotesDir();
  const notesFile = await getNotesFilePath();

  if (!fs.existsSync(notesFile)) {
    // Create new monthly file with header
    const monthYearHeader = `<h1>${getMonthYearDisplay()}</h1>\n\n`;
    await writeNotesFile(monthYearHeader);
    return monthYearHeader;
  }

  return fs.readFileSync(notesFile, 'utf-8');
}

/**
 * Writes content to the notes file
 * @param {string} content - The content to write
 * @returns {Promise<void>}
 */
export async function writeNotesFile(content) {
  await ensureNotesDir();
  const notesFile = await getNotesFilePath();
  fs.writeFileSync(notesFile, content, 'utf-8');
}

/**
 * Gets today's section from the notes content
 * @param {string} content - The full notes file content
 * @returns {TodaySection|null} The today section or null if not found
 */
export function getTodaySection(content) {
  const today = getTodayString();
  const todayHeaderRegex = new RegExp(`^<h2>${today.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h2>$`, 'm');

  if (!todayHeaderRegex.test(content)) {
    return null;
  }

  const lines = content.split('\n');
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === `<h2>${today}</h2>`) {
      startIdx = i;
    } else if (startIdx !== -1 && lines[i].startsWith('<h2>') && i > startIdx) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) return null;

  return {
    startIdx,
    endIdx,
    content: lines.slice(startIdx, endIdx).join('\n')
  };
}

/**
 * Initializes today's section in the notes file
 * @returns {Promise<string>} The today section content
 */
export async function initializeTodaySection() {
  const content = await readNotesFile();
  const today = getTodayString();

  const todaySection = getTodaySection(content);

  if (!todaySection) {
    const newSection = `<h2>${today}</h2>\n\n<h3>Todos</h3>\n<ul class="inline-task-list">\n</ul>\n\n<h3>Context</h3>\n\n<h3>References</h3>\n\n<h3>Notes</h3>\n<p></p>\n\n`;

    // Get the monthly header
    const monthHeader = `<h1>${getMonthYearDisplay()}</h1>\n\n`;

    // Check if content already has the monthly header
    const hasMonthHeader = content.startsWith(monthHeader) || content.startsWith(`<h1>${getMonthYearDisplay()}</h1>`);

    if (content.trim() && hasMonthHeader) {
      // Append to existing monthly file
      await writeNotesFile(content + '\n' + newSection);
    } else if (content.trim() && !hasMonthHeader) {
      // Prepend monthly header if missing
      await writeNotesFile(monthHeader + newSection);
    } else {
      // New file, just write the section
      await writeNotesFile(monthHeader + newSection);
    }

    return newSection;
  }

  return todaySection.content;
}

/**
 * Extracts todos from a section content
 * @param {string} sectionContent - The section content to extract todos from
 * @returns {TodoItem[]} Array of todo items
 */
export function extractTodos(sectionContent) {
  const lines = sectionContent.split('\n');
  const todos = [];
  let inTodoSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '<h3>Todos</h3>') {
      inTodoSection = true;
      continue;
    }

    if (line.startsWith('<h3>') && line !== '<h3>Todos</h3>') {
      inTodoSection = false;
    }

    if (inTodoSection && line.trim()) {
      // Match Confluence inline task format with data-inline-task-status
      const todoMatch = line.match(/<li data-inline-task-id="(\d+)"(?:\s+data-inline-task-status="(checked|unchecked)")?><span class="placeholder-inline-tasks"[^>]*>(.+?)<\/span><\/li>/);
      if (todoMatch) {
        const todoId = `todo-${todoMatch[1]}`;
        const status = todoMatch[2];
        const checked = status === 'checked';
        let text = todoMatch[3];
        const contextIds = [];

        // Extract all context links
        const anchorMatches = text.matchAll(/<a href="#context-([^"]+)"[^>]*>📎 [^<]+<\/a>/g);
        for (const match of anchorMatches) {
          contextIds.push(match[1]);
        }

        // Remove all context links from the text
        text = text.replace(/\s*<a href="#context-[^"]+"[^>]*>📎 [^<]+<\/a>/g, '').trim();

        todos.push({
          checked: checked,
          text: text,
          lineNumber: i,
          contextIds: contextIds,
          todoId: todoId
        });
      }
    }
  }

  return todos;
}

/**
 * Gets the next available todo ID number
 * @param {string} sectionContent - The section content
 * @returns {number} The next available todo ID number
 */
export function getNextTodoId(sectionContent) {
  const lines = sectionContent.split('\n');
  let maxId = 0;
  let inTodoSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '<h3>Todos</h3>') {
      inTodoSection = true;
      continue;
    }

    if (line.startsWith('<h3>') && line !== '<h3>Todos</h3>') {
      inTodoSection = false;
    }

    if (inTodoSection && line.trim()) {
      const idMatch = line.match(/data-inline-task-id="(\d+)"/);
      if (idMatch) {
        const id = parseInt(idMatch[1], 10);
        if (id > maxId) {
          maxId = id;
        }
      }
    }
  }

  return maxId + 1;
}

/**
 * Gets all todos that reference a specific context
 * @param {string} sectionContent - The section content
 * @param {string} contextId - The context ID to find references for
 * @returns {Array<{todoId: string, text: string}>} Array of todos referencing this context
 */
export function getTodosReferencingContext(sectionContent, contextId) {
  const todos = extractTodos(sectionContent);
  return todos
    .filter(todo => todo.contextIds.includes(contextId) && todo.todoId)
    .map(todo => ({
      todoId: todo.todoId,
      text: todo.text
    }));
}

/**
 * Updates a todo item's checked status in a section
 * @param {string} sectionContent - The section content
 * @param {number} lineNumber - The line number of the todo
 * @param {boolean} checked - Whether the todo should be checked
 * @returns {string} The updated section content
 */
export function updateTodoInSection(sectionContent, lineNumber, checked) {
  const lines = sectionContent.split('\n');
  const line = lines[lineNumber];

  if (line) {
    const todoMatch = line.match(/<li data-inline-task-id="(\d+)"(?:\s+data-inline-task-status="(?:checked|unchecked)")?><span class="placeholder-inline-tasks"[^>]*>(.+?)<\/span><\/li>/);
    if (todoMatch) {
      const todoId = todoMatch[1];
      const status = checked ? 'checked' : 'unchecked';
      const body = todoMatch[2];

      lines[lineNumber] = `<li data-inline-task-id="${todoId}" data-inline-task-status="${status}"><span class="placeholder-inline-tasks">${body}</span></li>`;
    }
  }

  return lines.join('\n');
}

/**
 * Replaces today's section with new content
 * @param {string} newSectionContent - The new section content
 * @returns {Promise<void>}
 */
export async function replaceTodaySection(newSectionContent) {
  const content = await readNotesFile();
  const todaySection = getTodaySection(content);

  if (!todaySection) {
    await writeNotesFile(newSectionContent);
    return;
  }

  const lines = content.split('\n');
  const before = lines.slice(0, todaySection.startIdx).join('\n');
  const after = lines.slice(todaySection.endIdx).join('\n');

  const newContent = [
    before,
    newSectionContent,
    after
  ].filter(s => s).join('\n');

  await writeNotesFile(newContent.trim() + '\n');
}

/**
 * Adds content to a specific section in today's notes
 * @param {string} sectionName - The name of the section
 * @param {string} content - The content to add
 * @returns {Promise<void>}
 */
export async function addContentToSection(sectionName, content) {
  const todaySection = await initializeTodaySection();
  const lines = todaySection.split('\n');

  let sectionIdx = -1;
  let nextSectionIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === `<h3>${sectionName}</h3>`) {
      sectionIdx = i;
    } else if (sectionIdx !== -1 && lines[i].startsWith('<h3>')) {
      nextSectionIdx = i;
      break;
    }
  }

  if (sectionIdx === -1) {
    lines.push(`<h3>${sectionName}</h3>`);
    lines.push('');
    lines.push(content);
    lines.push('');
  } else {
    // Find the last non-empty line in the section
    let insertIdx = nextSectionIdx;
    for (let i = nextSectionIdx - 1; i > sectionIdx; i--) {
      if (lines[i].trim()) {
        insertIdx = i + 1;
        break;
      }
    }

    if (insertIdx === sectionIdx + 1) {
      // Section is empty
      lines.splice(insertIdx, 0, content, '');
    } else {
      lines.splice(insertIdx, 0, '', content);
    }
  }

  await replaceTodaySection(lines.join('\n'));
}

/**
 * Adds context to the Context section with a unique ID
 * @param {string} contextId - The unique context ID
 * @param {string} contextText - The context text
 * @returns {Promise<void>}
 */
export async function addContext(contextId, contextText) {
  const formattedContent = `<ac:structured-macro ac:name="info" ac:schema-version="1"><ac:parameter ac:name="title">[${contextId}]</ac:parameter><ac:rich-text-body><p>${contextText}</p></ac:rich-text-body></ac:structured-macro>`;
  await addContentToSection('Context', formattedContent);
}

/**
 * Gets context text by ID from the section
 * @param {string} sectionContent - The section content
 * @param {string} contextId - The context ID to find
 * @returns {string|null} The context text or null if not found
 */
export function getContextById(sectionContent, contextId) {
  const lines = sectionContent.split('\n');
  let inContextSection = false;
  let inInfoPanel = false;
  const contextLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '<h3>Context</h3>') {
      inContextSection = true;
      continue;
    }

    if (inContextSection && line.startsWith('<h3>') && line !== '<h3>Context</h3>') {
      inContextSection = false;
      break;
    }

    if (inContextSection) {
      // Check for info panel with context ID
      if (line.includes(`<ac:parameter ac:name="title">[${contextId}]</ac:parameter>`)) {
        inInfoPanel = true;
        continue;
      }

      if (inInfoPanel) {
        // Check for end of info panel
        if (line.includes('</ac:structured-macro>')) {
          break;
        }
        // Check if we hit another context
        if (line.includes('<ac:structured-macro')) {
          break;
        }
        // Collect context lines
        if (line.trim() && !line.includes('ac:parameter') && !line.includes('ac:rich-text-body')) {
          contextLines.push(line);
        }
      }
    }
  }

  // Remove all HTML tags and return cleaned text
  return contextLines.length > 0 ? contextLines.join('\n').replace(/<[^>]+>/g, '').trim() : null;
}

/**
 * Updates context text for a given context ID
 * @param {string} contextId - The context ID
 * @param {string} newContextText - The new context text
 * @returns {Promise<void>}
 */
export async function updateContext(contextId, newContextText) {
  const todaySection = await initializeTodaySection();
  const lines = todaySection.split('\n');

  let inContextSection = false;
  let contextStartIdx = -1;
  let contextEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '<h3>Context</h3>') {
      inContextSection = true;
      continue;
    }

    if (line.startsWith('<h3>') && line !== '<h3>Context</h3>') {
      if (contextStartIdx !== -1) {
        contextEndIdx = i;
        break;
      }
      inContextSection = false;
    }

    if (inContextSection) {
      // Check for info panel format
      if (line.includes(`<ac:parameter ac:name="title">[${contextId}]</ac:parameter>`)) {
        // Find the start of the macro (might be on a previous line)
        for (let j = i; j >= 0; j--) {
          if (lines[j].includes('<ac:structured-macro ac:name="info"')) {
            contextStartIdx = j;
            break;
          }
        }
      } else if (contextStartIdx !== -1) {
        // Check for end of context block
        if (line.includes('</ac:structured-macro>')) {
          contextEndIdx = i + 1;
          break;
        }
      }
    }
  }

  if (contextStartIdx === -1) {
    return; // Context not found
  }

  if (contextEndIdx === -1) {
    contextEndIdx = lines.length;
  }

  // Replace the entire context block with updated version
  const newContextBlock = `<ac:structured-macro ac:name="info" ac:schema-version="1"><ac:parameter ac:name="title">[${contextId}]</ac:parameter><ac:rich-text-body><p>${newContextText}</p></ac:rich-text-body></ac:structured-macro>`;

  lines.splice(contextStartIdx, contextEndIdx - contextStartIdx, newContextBlock);

  await replaceTodaySection(lines.join('\n'));
}

/**
 * Deletes context by ID
 * @param {string} contextId - The context ID to delete
 * @returns {Promise<void>}
 */
export async function deleteContext(contextId) {
  const todaySection = await initializeTodaySection();
  const lines = todaySection.split('\n');

  let inContextSection = false;
  let contextStartIdx = -1;
  let contextEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '<h3>Context</h3>') {
      inContextSection = true;
      continue;
    }

    if (line.startsWith('<h3>') && line !== '<h3>Context</h3>') {
      if (contextStartIdx !== -1) {
        contextEndIdx = i;
        break;
      }
      inContextSection = false;
    }

    if (inContextSection) {
      // Check for info panel format
      if (line.includes(`<ac:parameter ac:name="title">[${contextId}]</ac:parameter>`)) {
        // Find the start of the macro (might be on a previous line)
        for (let j = i; j >= 0; j--) {
          if (lines[j].includes('<ac:structured-macro ac:name="info"')) {
            contextStartIdx = j;
            break;
          }
        }
      } else if (contextStartIdx !== -1) {
        // Check for end of context block
        if (line.includes('</ac:structured-macro>')) {
          contextEndIdx = i + 1;
          break;
        }
      }
    }
  }

  if (contextStartIdx === -1) {
    return; // Context not found
  }

  if (contextEndIdx === -1) {
    contextEndIdx = lines.length;
  }

  // Remove the context block
  lines.splice(contextStartIdx, contextEndIdx - contextStartIdx);

  await replaceTodaySection(lines.join('\n'));
}

/**
 * Gets all contexts from the section
 * @param {string} sectionContent - The section content
 * @returns {Array<{id: string, text: string}>} Array of context objects
 */
export function getAllContexts(sectionContent) {
  const lines = sectionContent.split('\n');
  const contexts = [];
  let inContextSection = false;
  let currentContextId = null;
  let inInfoPanel = false;
  let currentContextLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '<h3>Context</h3>') {
      inContextSection = true;
      continue;
    }

    if (line.startsWith('<h3>') && line !== '<h3>Context</h3>') {
      // Save any pending context
      if (currentContextId && currentContextLines.length > 0) {
        contexts.push({
          id: currentContextId,
          text: currentContextLines.join('\n').replace(/<[^>]+>/g, '').trim()
        });
      }
      inContextSection = false;
      break;
    }

    if (inContextSection) {
      // Check for info panel format
      const titleMatch = line.match(/<ac:parameter ac:name="title">\[(.+?)\]<\/ac:parameter>/);
      if (titleMatch) {
        // Save previous context if any
        if (currentContextId && currentContextLines.length > 0) {
          contexts.push({
            id: currentContextId,
            text: currentContextLines.join('\n').replace(/<[^>]+>/g, '').trim()
          });
        }
        // Start new context
        currentContextId = titleMatch[1];
        currentContextLines = [];
        inInfoPanel = true;
      } else if (inInfoPanel) {
        if (line.includes('</ac:structured-macro>')) {
          // End of current context
          if (currentContextId && currentContextLines.length > 0) {
            contexts.push({
              id: currentContextId,
              text: currentContextLines.join('\n').replace(/<[^>]+>/g, '').trim()
            });
          }
          currentContextId = null;
          currentContextLines = [];
          inInfoPanel = false;
        } else if (line.trim() && !line.includes('ac:parameter') && !line.includes('ac:rich-text-body') && !line.includes('<ac:structured-macro')) {
          currentContextLines.push(line);
        }
      }
    }
  }

  // Don't forget the last context
  if (currentContextId && currentContextLines.length > 0) {
    contexts.push({
      id: currentContextId,
      text: currentContextLines.join('\n').replace(/<[^>]+>/g, '').trim()
    });
  }

  return contexts;
}

/**
 * Gets all monthly notes files in the notes directory
 * @returns {Promise<string[]>} Array of file paths for monthly notes
 */
export async function getAllMonthlyNotesFiles() {
  const config = await getConfig();
  const pattern = path.join(config.notesDirectory, '*-notes.html').replace(/\\/g, '/');
  const files = await glob(pattern);
  return files;
}

/**
 * Checks if an ID (context or reference) exists in any monthly notes file
 * @param {string} id - The ID to check for
 * @returns {Promise<boolean>} True if the ID exists, false otherwise
 */
export async function idExistsInAnyFile(id) {
  const files = await getAllMonthlyNotesFiles();

  for (const file of files) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for context IDs: <p><strong>[id]</strong></p> or [context: id]
      const contextRegex1 = new RegExp(`<p><strong>\\[${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]</strong></p>`);
      const contextRegex2 = new RegExp(`\\[context: ${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`);

      // Check for reference IDs: <ac:structured-macro ... data-ref-id="id"
      const refRegex = new RegExp(`data-ref-id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);

      if (contextRegex1.test(content) || contextRegex2.test(content) || refRegex.test(content)) {
        return true;
      }
    }
  }

  return false;
}
