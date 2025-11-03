import inquirer from 'inquirer';
import chalk from 'chalk';
import { addContentToSection } from '../utils/fileHandler.js';
import { performAutoSync } from './sync.js';

/**
 * Adds content to the notes section
 * @param {string} text - The text to add (optional, will prompt if not provided)
 * @returns {Promise<void>}
 */
export async function addNote(text) {
  let content = text;

  if (!content || !content.trim()) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'content',
        message: 'What note would you like to add?',
        validate: (input) => {
          if (!input.trim()) {
            return 'Content cannot be empty';
          }
          return true;
        }
      }
    ]);
    content = answers.content;
  }

  // Get current timestamp
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const formattedContent = `<p style="color: #888; font-size: 0.85em; margin-bottom: 5px;">${timeString}</p>\n<p>${content}</p>`;
  await addContentToSection('Notes', formattedContent);

  console.log(chalk.green('✓') + ' Note added!');

  // Sync to Confluence if enabled (respects silentSync setting)
  await performAutoSync();
}
