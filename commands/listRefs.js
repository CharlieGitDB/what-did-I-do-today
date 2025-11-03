import termkit from 'terminal-kit';
import inquirer from 'inquirer';
import {
  initializeTodaySection,
  extractReferences,
  deleteReferenceInSection,
  updateReferenceInSection,
  replaceTodaySection
} from '../utils/fileHandler.js';
import { performAutoSync } from './sync.js';

const term = termkit.terminal;

/**
 * Displays and allows management of references for today with vim-style controls
 * @returns {Promise<void>}
 */
export async function listRefs() {
  await showRefsList();
}

/**
 * Shows the references list with vim controls
 * @returns {Promise<void>}
 */
async function showRefsList() {
  let selectedIndex = 0;
  let running = true;

  term.grabInput(true);
  term.hideCursor(true);

  while (running) {
    const todaySection = await initializeTodaySection();
    const refs = extractReferences(todaySection);

    term.clear();
    term.cyan.bold('  📋 REFERENCES MANAGER\n\n');
    term.gray('  ').white('j/k/↑↓').gray(': Navigate  ').white('v').gray(': View  ').white('e').gray(': Edit  ').white('d').gray(': Delete  ').white('a').gray(': Add  ').white('ESC').gray(': Exit\n\n');

    if (refs.length === 0) {
      term.yellow('  No references for today!\n');
      term.gray('  Press ').white('a').gray(' to add a reference or ').white('ESC').gray(' to exit.\n');
    } else {
      // Render refs list
      refs.forEach((ref, idx) => {
        if (idx === selectedIndex) {
          // Selected item - inverted colors
          if (ref.timestamp) {
            term.bgWhite.gray(`  ${ref.timestamp} `);
          }
          term.bgWhite.cyan(`[${ref.id}] `);
          term.bgWhite.black(`${ref.content.substring(0, 60)}${ref.content.length > 60 ? '...' : ''}  `).white('\n');
        } else {
          // Unselected item
          if (ref.timestamp) {
            term.gray(`  ${ref.timestamp} `);
          }
          term.cyan(`[${ref.id}] `);
          term.white(`${ref.content.substring(0, 60)}${ref.content.length > 60 ? '...' : ''}\n`);
        }
      });

      // Ensure selectedIndex is valid
      if (selectedIndex >= refs.length) {
        selectedIndex = refs.length - 1;
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
      if (refs.length > 0) {
        selectedIndex = Math.max(0, selectedIndex - 1);
      }
    } else if (key === 'DOWN' || key === 'j') {
      if (refs.length > 0) {
        selectedIndex = Math.min(refs.length - 1, selectedIndex + 1);
      }
    } else if (key === 'v' || key === 'V') {
      // View full reference
      if (refs.length > 0 && selectedIndex < refs.length) {
        await viewReferenceInteractive(refs[selectedIndex]);
      }
    } else if (key === 'e' || key === 'E') {
      // Edit reference
      if (refs.length > 0 && selectedIndex < refs.length) {
        await editReferenceInteractive(refs[selectedIndex], todaySection);
      }
    } else if (key === 'd' || key === 'D') {
      // Delete reference
      if (refs.length > 0 && selectedIndex < refs.length) {
        await deleteReferenceInteractive(refs[selectedIndex], todaySection);
        if (selectedIndex >= refs.length - 1 && selectedIndex > 0) {
          selectedIndex--;
        }
      }
    } else if (key === 'a' || key === 'A') {
      // Add reference
      await addReferenceInteractive();
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
 * Views the full content of a reference
 * @param {Object} ref - The reference to view
 * @returns {Promise<void>}
 */
async function viewReferenceInteractive(ref) {
  term.grabInput(false);
  term.hideCursor(false);

  term.clear();
  term.cyan.bold(`\n  Reference: [${ref.id}]\n\n`);
  if (ref.timestamp) {
    term.gray(`  Created: ${ref.timestamp}\n\n`);
  }
  term.white(`  ${ref.content}\n\n`);
  term.gray('  Press any key to return...');

  await new Promise((resolve) => {
    term.once('key', () => resolve());
  });

  term.hideCursor(true);
  term.grabInput(true);
}

/**
 * Adds a new reference interactively
 * @returns {Promise<void>}
 */
async function addReferenceInteractive() {
  term.grabInput(false);
  term.hideCursor(false);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'refContent',
      message: 'Enter reference content:',
      validate: (input) => {
        if (!input.trim()) {
          return 'Reference content cannot be empty';
        }
        return true;
      }
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  // Import addRef command
  const { addRef } = await import('./addRef.js');
  await addRef(answers.refContent);
}

/**
 * Edits a reference interactively
 * @param {Object} ref - The reference to edit
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function editReferenceInteractive(ref, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  const { newContent } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newContent',
      message: 'Enter new reference content:',
      default: ref.content,
      validate: (input) => {
        if (!input.trim()) {
          return 'Reference content cannot be empty';
        }
        return true;
      }
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  const updatedSection = updateReferenceInSection(todaySection, ref.lineNumber, ref.id, newContent);
  await replaceTodaySection(updatedSection);
}

/**
 * Deletes a reference interactively
 * @param {Object} ref - The reference to delete
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function deleteReferenceInteractive(ref, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Delete reference [${ref.id}]?`,
      default: false
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  if (confirm) {
    const updatedSection = deleteReferenceInSection(todaySection, ref.lineNumber);
    await replaceTodaySection(updatedSection);
  }
}
