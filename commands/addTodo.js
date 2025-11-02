import inquirer from 'inquirer';
import chalk from 'chalk';
import { initializeTodaySection, replaceTodaySection, addContext, idExistsInAnyFile, getNextTodoId } from '../utils/fileHandler.js';
import { generateUniqueThreeWordId } from '../utils/wordGenerator.js';

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

  // Generate unique context ID and add context if provided
  if (finalContextText && finalContextText.trim()) {
    contextId = await generateUniqueThreeWordId(idExistsInAnyFile);
    await addContext(contextId, finalContextText);
  }

  const todaySection = await initializeTodaySection();
  const lines = todaySection.split('\n');

  let todoSectionIdx = -1;
  let ulIdx = -1;
  let insertIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '<h3>Todos</h3>') {
      todoSectionIdx = i;
      continue;
    }

    if (todoSectionIdx !== -1 && ulIdx === -1 && (lines[i] === '<ul class="inline-task-list">' || lines[i] === '<ul>')) {
      ulIdx = i;
      continue;
    }

    if (todoSectionIdx !== -1 && lines[i] === '</ul>') {
      insertIdx = i;
      break;
    }

    if (todoSectionIdx !== -1 && lines[i].startsWith('<h3>') && lines[i] !== '<h3>Todos</h3>') {
      break;
    }
  }

  if (insertIdx === -1 || ulIdx === -1) {
    // No ul found, shouldn't happen with our structure but handle it
    insertIdx = todoSectionIdx + 2;
  }

  // Get next sequential todo ID
  const todoId = getNextTodoId(todaySection);

  // Create todo line with ID and status attribute (no Unicode characters)
  let todoLine;
  if (contextId) {
    todoLine = `<li data-inline-task-id="${todoId}" data-inline-task-status="unchecked"><span class="placeholder-inline-tasks">${todoText} <a href="#context-${contextId}" style="color: #0066cc;">📎 ${contextId}</a></span></li>`;
  } else {
    todoLine = `<li data-inline-task-id="${todoId}" data-inline-task-status="unchecked"><span class="placeholder-inline-tasks">${todoText}</span></li>`;
  }

  lines.splice(insertIdx, 0, todoLine);

  await replaceTodaySection(lines.join('\n'));

  if (contextId) {
    console.log(chalk.green('✓') + ` Todo added with context ID: ${chalk.cyan(contextId)}`);
  } else {
    console.log(chalk.green('✓') + ' Todo added successfully!');
  }
}
