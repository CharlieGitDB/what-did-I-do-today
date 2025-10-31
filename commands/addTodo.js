import inquirer from 'inquirer';
import chalk from 'chalk';
import { initializeTodaySection, replaceTodaySection, addContext } from '../utils/fileHandler.js';
import { generateThreeWordId } from '../utils/wordGenerator.js';

/**
 * Adds a new todo item to today's notes
 * @param {string} [text] - The todo text (optional, will prompt if not provided)
 * @param {string} [contextText] - The context text (optional)
 * @returns {Promise<void>}
 */
export async function addTodo(text, contextText) {
  let todoText = text;

  // If no text provided or empty, prompt the user
  if (!todoText || !todoText.trim()) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'todo',
        message: 'What todo would you like to add?',
        validate: (input) => {
          if (!input.trim()) {
            return 'Todo cannot be empty';
          }
          return true;
        }
      }
    ]);
    todoText = answers.todo;
  }

  let contextId = null;
  let finalContextText = contextText;

  // If context not provided via flag, ask if they want to add context
  if (!finalContextText || !finalContextText.trim()) {
    const { wantContext } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'wantContext',
        message: 'Would you like to add context to this todo?',
        default: false
      }
    ]);

    if (wantContext) {
      const contextAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'context',
          message: 'Enter context for this todo:',
          validate: (input) => {
            if (!input.trim()) {
              return 'Context cannot be empty';
            }
            return true;
          }
        }
      ]);
      finalContextText = contextAnswer.context;
    }
  }

  // Generate context ID and add context if provided
  if (finalContextText && finalContextText.trim()) {
    contextId = generateThreeWordId();
    await addContext(contextId, finalContextText);
  }

  const todaySection = await initializeTodaySection();
  const lines = todaySection.split('\n');

  let todoSectionIdx = -1;
  let insertIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '### Todos') {
      todoSectionIdx = i;
    } else if (todoSectionIdx !== -1 && lines[i].startsWith('### ')) {
      insertIdx = i;
      break;
    }
  }

  if (insertIdx === -1) {
    insertIdx = lines.length;
  }

  // Find last todo or section header
  let lastTodoIdx = todoSectionIdx + 1;
  for (let i = todoSectionIdx + 1; i < insertIdx; i++) {
    if (lines[i].trim()) {
      lastTodoIdx = i + 1;
    }
  }

  const todoLine = contextId
    ? `- [ ] ${todoText} [context: ${contextId}]`
    : `- [ ] ${todoText}`;

  if (lastTodoIdx === todoSectionIdx + 1 && !lines[lastTodoIdx]?.trim()) {
    lines.splice(lastTodoIdx, 0, todoLine);
  } else {
    lines.splice(lastTodoIdx, 0, todoLine);
  }

  await replaceTodaySection(lines.join('\n'));

  if (contextId) {
    console.log(chalk.green('✓') + ` Todo added with context ID: ${chalk.cyan(contextId)}`);
  } else {
    console.log(chalk.green('✓') + ' Todo added successfully!');
  }
}
