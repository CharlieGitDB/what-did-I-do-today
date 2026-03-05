import termkit from 'terminal-kit';
import inquirer from 'inquirer';
import {
  initializeTodaySection,
  extractNotes,
  deleteNoteInSection,
  updateNoteInSection,
  replaceTodaySection,
  addContentToSection
} from '../utils/fileHandler.js';
import { performAutoSync } from './sync.js';
import { openEditor } from '../editor/index.js';

const term = termkit.terminal;

/**
 * Displays and allows management of notes for today with vim-style controls
 * @returns {Promise<void>}
 */
export async function listNotes() {
  await showNotesList();
}

/**
 * Shows the notes list with vim controls
 * @returns {Promise<void>}
 */
async function showNotesList() {
  let selectedIndex = 0;
  let running = true;

  term.grabInput(true);
  term.hideCursor(true);

  while (running) {
    const todaySection = await initializeTodaySection();
    const notes = extractNotes(todaySection);

    term.clear();
    term.cyan.bold('  NOTES MANAGER\n\n');
    term.gray('  ').white('j/k').gray(': Navigate  ').white('e').gray(': Edit  ').white('d').gray(': Delete  ').white('a').gray(': Add  ').white('ESC').gray(': Exit\n\n');

    if (notes.length === 0) {
      term.yellow('  No notes for today!\n');
      term.gray('  Press ').white('a').gray(' to add a note or ').white('ESC').gray(' to exit.\n');
    } else {
      // Render notes list
      notes.forEach((note, idx) => {
        if (idx === selectedIndex) {
          // Selected item - inverted colors
          if (note.timestamp) {
            term.bgWhite.gray(`  ${note.timestamp} `);
          }
          term.bgWhite.black(`  ${note.text.substring(0, 80)}${note.text.length > 80 ? '...' : ''}  `).white('\n');
        } else {
          // Unselected item
          if (note.timestamp) {
            term.gray(`  ${note.timestamp} `);
          }
          term.white(`  ${note.text.substring(0, 80)}${note.text.length > 80 ? '...' : ''}\n`);
        }
      });

      // Ensure selectedIndex is valid
      if (selectedIndex >= notes.length) {
        selectedIndex = notes.length - 1;
      }
      if (selectedIndex < 0) {
        selectedIndex = 0;
      }
    }

    term('\n');

    // Wait for keypress
    const key = await new Promise((resolve) => {
      term.once('key', (name) => resolve(name));
    });

    // Handle navigation
    if (key === 'UP' || key === 'k') {
      if (notes.length > 0) {
        selectedIndex = Math.max(0, selectedIndex - 1);
      }
    } else if (key === 'DOWN' || key === 'j') {
      if (notes.length > 0) {
        selectedIndex = Math.min(notes.length - 1, selectedIndex + 1);
      }
    } else if (key === 'e' || key === 'E') {
      // Edit note with WYSIWYG editor
      if (notes.length > 0 && selectedIndex < notes.length) {
        await editNoteInteractive(notes[selectedIndex], todaySection);
      }
    } else if (key === 'd' || key === 'D') {
      // Delete note
      if (notes.length > 0 && selectedIndex < notes.length) {
        await deleteNoteInteractive(notes[selectedIndex], todaySection);
        if (selectedIndex >= notes.length - 1 && selectedIndex > 0) {
          selectedIndex--;
        }
      }
    } else if (key === 'a' || key === 'A') {
      // Add note with WYSIWYG editor
      await addNoteWithEditor();
    } else if (key === 'ESCAPE') {
      // Exit
      running = false;
    }
  }

  term.grabInput(false);
  term.hideCursor(false);
  term.clear();

  // Sync to Confluence if enabled (respects silentSync setting)
  await performAutoSync();
}

/**
 * Adds a new note using the WYSIWYG editor
 * @returns {Promise<void>}
 */
async function addNoteWithEditor() {
  term.grabInput(false);
  term.hideCursor(false);

  const html = await openEditor();

  term.hideCursor(true);
  term.grabInput(true);

  if (html) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const formattedContent = `<p style="color: #888; font-size: 0.85em; margin-bottom: 5px;">${timeString}</p>\n${html}`;
    await addContentToSection('Notes', formattedContent);
  }
}

/**
 * Edits a note using the WYSIWYG editor
 * @param {Object} note - The note to edit
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function editNoteInteractive(note, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  // Get the raw HTML content of the note for editing
  const lines = todaySection.split('\n');
  let noteHtml = '';
  const lineNum = note.lineNumber;

  // Check if there's a timestamp line before the content
  if (lines[lineNum] && lines[lineNum].includes('style="color: #888"')) {
    // Collect content lines after the timestamp
    let j = lineNum + 1;
    const contentLines = [];
    while (j < lines.length) {
      const line = lines[j];
      contentLines.push(line);
      // Check if this is the end of the note content
      if (line.includes('</p>') || line.includes('</ul>') || line.includes('</ol>') || line.includes('</h1>') || line.includes('</h2>') || line.includes('</h3>')) {
        // Look ahead to see if next line is still part of this note
        if (j + 1 < lines.length) {
          const nextLine = lines[j + 1];
          if (nextLine.startsWith('<p style="color: #888"') || nextLine.startsWith('<h3>') || !nextLine.trim()) {
            break;
          }
        } else {
          break;
        }
      }
      j++;
    }
    noteHtml = contentLines.join('\n');
  } else {
    // No timestamp — the note is a simple <p> block
    noteHtml = `<p>${note.text}</p>`;
  }

  const newHtml = await openEditor(noteHtml);

  term.hideCursor(true);
  term.grabInput(true);

  if (newHtml) {
    // Replace the old note content in the section
    const sectionLines = todaySection.split('\n');
    const startLine = note.lineNumber;

    // Determine how many lines the old note occupies
    let endLine = startLine;
    if (sectionLines[startLine] && sectionLines[startLine].includes('style="color: #888"')) {
      endLine = startLine + 1;
      // Find end of content
      while (endLine < sectionLines.length) {
        if (sectionLines[endLine].includes('</p>') || sectionLines[endLine].includes('</ul>') || sectionLines[endLine].includes('</ol>')) {
          break;
        }
        endLine++;
      }
    }

    // Rebuild with timestamp preserved + new HTML content
    const timestamp = note.timestamp;
    let replacement;
    if (timestamp) {
      replacement = `<p style="color: #888; font-size: 0.85em; margin-bottom: 5px;">${timestamp}</p>\n${newHtml}`;
    } else {
      replacement = newHtml;
    }

    sectionLines.splice(startLine, endLine - startLine + 1, replacement);
    await replaceTodaySection(sectionLines.join('\n'));
  }
}

/**
 * Deletes a note interactively
 * @param {Object} note - The note to delete
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function deleteNoteInteractive(note, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Delete this note?',
      default: false
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  if (confirm) {
    const updatedSection = deleteNoteInSection(todaySection, note.lineNumber);
    await replaceTodaySection(updatedSection);
  }
}
