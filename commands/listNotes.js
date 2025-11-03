import termkit from 'terminal-kit';
import inquirer from 'inquirer';
import {
  initializeTodaySection,
  extractNotes,
  deleteNoteInSection,
  updateNoteInSection,
  replaceTodaySection
} from '../utils/fileHandler.js';
import { performAutoSync } from './sync.js';

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
    term.cyan.bold('  📝 NOTES MANAGER\n\n');
    term.gray('  ').white('j/k/↑↓').gray(': Navigate  ').white('e').gray(': Edit  ').white('d').gray(': Delete  ').white('a').gray(': Add  ').white('ESC').gray(': Exit\n\n');

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
      // Edit note
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
      // Add note
      await addNoteInteractive();
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
 * Adds a new note interactively
 * @returns {Promise<void>}
 */
async function addNoteInteractive() {
  term.grabInput(false);
  term.hideCursor(false);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'noteText',
      message: 'Enter note:',
      validate: (input) => {
        if (!input.trim()) {
          return 'Note cannot be empty';
        }
        return true;
      }
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  // Import addNote command
  const { addNote } = await import('./addNote.js');
  await addNote(answers.noteText);
}

/**
 * Edits a note interactively
 * @param {Object} note - The note to edit
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function editNoteInteractive(note, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  const { newText } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newText',
      message: 'Enter new note text:',
      default: note.text,
      validate: (input) => {
        if (!input.trim()) {
          return 'Note text cannot be empty';
        }
        return true;
      }
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  const updatedSection = updateNoteInSection(todaySection, note.lineNumber, newText);
  await replaceTodaySection(updatedSection);
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
