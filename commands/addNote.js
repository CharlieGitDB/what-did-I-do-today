import inquirer from 'inquirer';
import chalk from 'chalk';
import { addContentToSection } from '../utils/fileHandler.js';

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

  const formattedContent = `${content}`;
  await addContentToSection('Notes', formattedContent);

  console.log(chalk.green('✓') + ' Note added!');
}
