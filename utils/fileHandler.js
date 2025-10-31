import fs from 'fs';
import path from 'path';
import { getConfig } from './config.js';

/**
 * @typedef {Object} TodoItem
 * @property {boolean} checked - Whether the todo is checked
 * @property {string} text - The todo text
 * @property {number} lineNumber - The line number in the section
 * @property {string|null} contextId - The context ID if it exists
 */

/**
 * @typedef {Object} TodaySection
 * @property {number} startIdx - Starting line index
 * @property {number} endIdx - Ending line index
 * @property {string} content - The section content
 */

/**
 * Gets the path to the notes file
 * @returns {Promise<string>} The path to the notes file
 */
export async function getNotesFilePath() {
  const config = await getConfig();
  return path.join(config.notesDirectory, 'notes.md');
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
 * Reads the notes file
 * @returns {Promise<string>} The content of the notes file
 */
export async function readNotesFile() {
  await ensureNotesDir();
  const notesFile = await getNotesFilePath();

  if (!fs.existsSync(notesFile)) {
    return '';
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
  const todayHeaderRegex = new RegExp(`^# ${today.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm');

  if (!todayHeaderRegex.test(content)) {
    return null;
  }

  const lines = content.split('\n');
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === `# ${today}`) {
      startIdx = i;
    } else if (startIdx !== -1 && lines[i].startsWith('# ') && i > startIdx) {
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
    const newSection = `# ${today}\n\n## Todos\n\n## Context\n\n## References\n\n## Notes\n\n`;

    if (content.trim()) {
      await writeNotesFile(newSection + '\n---\n\n' + content);
    } else {
      await writeNotesFile(newSection);
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

    if (line === '## Todos') {
      inTodoSection = true;
      continue;
    }

    if (line.startsWith('## ') && line !== '## Todos') {
      inTodoSection = false;
    }

    if (inTodoSection && line.trim()) {
      const todoMatch = line.match(/^- \[([ x])\] (.+)$/);
      if (todoMatch) {
        let text = todoMatch[2];
        let contextId = null;

        // Check if there's a context ID in the format [context: id]
        const contextMatch = text.match(/\[context: ([^\]]+)\]$/);
        if (contextMatch) {
          contextId = contextMatch[1];
          // Remove the context part from the text
          text = text.replace(/\s*\[context: [^\]]+\]$/, '');
        }

        todos.push({
          checked: todoMatch[1] === 'x',
          text: text,
          lineNumber: i,
          contextId: contextId
        });
      }
    }
  }

  return todos;
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
    const todoMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (todoMatch) {
      lines[lineNumber] = `- [${checked ? 'x' : ' '}] ${todoMatch[2]}`;
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
    if (lines[i] === `## ${sectionName}`) {
      sectionIdx = i;
    } else if (sectionIdx !== -1 && lines[i].startsWith('## ')) {
      nextSectionIdx = i;
      break;
    }
  }

  if (sectionIdx === -1) {
    lines.push(`## ${sectionName}`);
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
  const formattedContent = `**[${contextId}]**\n${contextText}`;
  await addContentToSection('## Context', formattedContent);
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
  let foundContext = false;
  const contextLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '## Context') {
      inContextSection = true;
      continue;
    }

    if (line.startsWith('## ') && line !== '## Context') {
      if (foundContext) break;
      inContextSection = false;
    }

    if (inContextSection) {
      if (line === `**[${contextId}]**`) {
        foundContext = true;
        continue;
      }

      if (foundContext) {
        // Check if we hit another context ID
        if (line.match(/^\*\*\[.+\]\*\*$/)) {
          break;
        }
        if (line.trim()) {
          contextLines.push(line);
        }
      }
    }
  }

  return contextLines.length > 0 ? contextLines.join('\n') : null;
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

    if (line === '## Context') {
      inContextSection = true;
      continue;
    }

    if (line.startsWith('## ') && line !== '## Context') {
      if (contextStartIdx !== -1) {
        contextEndIdx = i;
        break;
      }
      inContextSection = false;
    }

    if (inContextSection) {
      if (line === `**[${contextId}]**`) {
        contextStartIdx = i;
      } else if (contextStartIdx !== -1 && line.match(/^\*\*\[.+\]\*\*$/)) {
        contextEndIdx = i;
        break;
      }
    }
  }

  if (contextStartIdx === -1) {
    return; // Context not found
  }

  if (contextEndIdx === -1) {
    contextEndIdx = lines.length;
  }

  // Remove old context lines (excluding the ID line)
  const linesToRemove = contextEndIdx - contextStartIdx - 1;
  lines.splice(contextStartIdx + 1, linesToRemove, newContextText);

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

    if (line === '## Context') {
      inContextSection = true;
      continue;
    }

    if (line.startsWith('## ') && line !== '## Context') {
      if (contextStartIdx !== -1) {
        contextEndIdx = i;
        break;
      }
      inContextSection = false;
    }

    if (inContextSection) {
      if (line === `**[${contextId}]**`) {
        contextStartIdx = i;
      } else if (contextStartIdx !== -1 && line.match(/^\*\*\[.+\]\*\*$/)) {
        contextEndIdx = i;
        break;
      }
    }
  }

  if (contextStartIdx === -1) {
    return; // Context not found
  }

  if (contextEndIdx === -1) {
    // Find the next non-empty line or end
    for (let i = contextStartIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ') || (lines[i].trim() && lines[i].match(/^\*\*\[.+\]\*\*$/))) {
        contextEndIdx = i;
        break;
      }
    }
    if (contextEndIdx === -1) {
      contextEndIdx = lines.length;
    }
  }

  // Remove the context block including empty lines
  lines.splice(contextStartIdx, contextEndIdx - contextStartIdx);

  await replaceTodaySection(lines.join('\n'));
}
