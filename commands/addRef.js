import inquirer from 'inquirer';
import chalk from 'chalk';
import { addContentToSection, idExistsInAnyFile } from '../utils/fileHandler.js';
import { generateUniqueThreeWordId } from '../utils/wordGenerator.js';

/**
 * Adds content to the references section with a unique 3-word identifier
 * @param {string} text - The text to add (optional, will prompt if not provided)
 * @returns {Promise<void>}
 */
export async function addRef(text) {
  let content = text;

  if (!content || !content.trim()) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'content',
        message: 'What would you like to save as a reference?',
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

  const refId = await generateUniqueThreeWordId(idExistsInAnyFile);
  const formattedContent = `#ref [${refId}]\n${content}\n#/ref`;
  await addContentToSection('References', formattedContent);

  console.log(chalk.green('✓') + ` Reference saved with ID: ${chalk.cyan(refId)}`);
}
