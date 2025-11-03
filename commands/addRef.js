import inquirer from 'inquirer';
import chalk from 'chalk';
import { addContentToSection, idExistsInAnyFile } from '../utils/fileHandler.js';
import { generateUniqueThreeWordId } from '../utils/wordGenerator.js';
import { performAutoSync } from './sync.js';

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

  // Get current timestamp
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const formattedContent = `<p style="color: #888; font-size: 0.85em; margin-bottom: 5px;">${timeString}</p>\n<ac:structured-macro ac:name="code" data-ref-id="${refId}"><ac:parameter ac:name="title">[${refId}]</ac:parameter><ac:plain-text-body><![CDATA[${content}]]></ac:plain-text-body></ac:structured-macro>`;
  await addContentToSection('References', formattedContent);

  console.log(chalk.green('✓') + ` Reference saved with ID: ${chalk.cyan(refId)}`);

  // Sync to Confluence if enabled (respects silentSync setting)
  await performAutoSync();
}
