import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  initializeTodaySection,
  extractTodos,
  updateTodoInSection,
  replaceTodaySection,
  getContextById,
  addContext,
  updateContext,
  deleteContext,
  idExistsInAnyFile
} from '../utils/fileHandler.js';
import { generateUniqueThreeWordId } from '../utils/wordGenerator.js';

/**
 * Deletes a todo from the section
 * @param {string} sectionContent - The section content
 * @param {number} lineNumber - The line number of the todo to delete
 * @returns {string} The updated section content
 */
function deleteTodoFromSection(sectionContent, lineNumber) {
  const lines = sectionContent.split('\n');
  lines.splice(lineNumber, 1);
  return lines.join('\n');
}

/**
 * Edits a todo's text in the section
 * @param {string} sectionContent - The section content
 * @param {number} lineNumber - The line number of the todo
 * @param {string} newText - The new todo text
 * @returns {string} The updated section content
 */
function editTodoInSection(sectionContent, lineNumber, newText) {
  const lines = sectionContent.split('\n');
  const line = lines[lineNumber];

  if (line) {
    const todoMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (todoMatch) {
      lines[lineNumber] = `- [${todoMatch[1]}] ${newText}`;
    }
  }

  return lines.join('\n');
}

/**
 * Updates or adds a context ID to a todo
 * @param {string} sectionContent - The section content
 * @param {number} lineNumber - The line number of the todo
 * @param {string|null} contextId - The context ID to add/update, or null to remove
 * @returns {string} The updated section content
 */
function updateTodoContext(sectionContent, lineNumber, contextId) {
  const lines = sectionContent.split('\n');
  const line = lines[lineNumber];

  if (line) {
    const todoMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (todoMatch) {
      const checked = todoMatch[1];
      let text = todoMatch[2];

      // Remove existing context if present
      text = text.replace(/\s*\[context: [^\]]+\]$/, '');

      // Add new context if provided
      if (contextId) {
        lines[lineNumber] = `- [${checked}] ${text} [context: ${contextId}]`;
      } else {
        lines[lineNumber] = `- [${checked}] ${text}`;
      }
    }
  }

  return lines.join('\n');
}

/**
 * Displays and allows toggling, editing, and deleting of todos for today
 * @returns {Promise<void>}
 */
export async function listTodos() {
  let todaySection = await initializeTodaySection();
  let todos = extractTodos(todaySection);

  if (todos.length === 0) {
    console.log(chalk.yellow('No todos for today. Use "wdidt add" to add some!'));
    return;
  }

  // First, allow toggling todos
  const toggleAnswers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedTodos',
      message: 'Select/deselect todos (space to toggle, enter to continue):',
      choices: todos.map((todo, index) => ({
        name: todo.text,
        value: index,
        checked: todo.checked
      }))
    }
  ]);

  let updatedSection = todaySection;

  // Update all todos based on selections
  todos.forEach((todo, index) => {
    const shouldBeChecked = toggleAnswers.selectedTodos.includes(index);
    if (todo.checked !== shouldBeChecked) {
      updatedSection = updateTodoInSection(updatedSection, todo.lineNumber, shouldBeChecked);
    }
  });

  await replaceTodaySection(updatedSection);
  console.log(chalk.green('✓') + ' Todos updated!');

  // Ask if user wants to edit or delete any todos
  const { wantMoreActions } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'wantMoreActions',
      message: 'Would you like to edit or delete any todos?',
      default: false
    }
  ]);

  if (!wantMoreActions) {
    return;
  }

  // Loop for editing/deleting
  let continueEditing = true;
  while (continueEditing) {
    // Refresh todos from file
    todaySection = await initializeTodaySection();
    todos = extractTodos(todaySection);

    if (todos.length === 0) {
      console.log(chalk.yellow('No todos left!'));
      break;
    }

    const { selectedTodo } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTodo',
        message: 'Select a todo:',
        choices: [
          ...todos.map((todo, index) => ({
            name: `${todo.checked ? '[✓]' : '[ ]'} ${todo.text}${todo.contextId ? chalk.gray(' 📎') : ''}`,
            value: index
          })),
          new inquirer.Separator(),
          { name: chalk.gray('Done'), value: -1 }
        ]
      }
    ]);

    if (selectedTodo === -1) {
      break;
    }

    const selectedTodoItem = todos[selectedTodo];
    const actionChoices = [
      { name: 'Edit todo text', value: 'edit' },
      { name: 'Delete todo', value: 'delete' }
    ];

    // Add context-related options
    if (selectedTodoItem.contextId) {
      actionChoices.push(
        { name: 'View context', value: 'view_context' },
        { name: 'Edit context', value: 'edit_context' },
        { name: 'Delete context', value: 'delete_context' }
      );
    } else {
      actionChoices.push({ name: 'Add context', value: 'add_context' });
    }

    actionChoices.push({ name: chalk.gray('Cancel'), value: 'cancel' });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: actionChoices
      }
    ]);

    if (action === 'cancel') {
      continue;
    }

    if (action === 'delete') {
      updatedSection = deleteTodoFromSection(todaySection, selectedTodoItem.lineNumber);
      await replaceTodaySection(updatedSection);
      console.log(chalk.green('✓') + ' Todo deleted!');
    } else if (action === 'edit') {
      const { newText } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newText',
          message: 'Enter new todo text:',
          default: selectedTodoItem.text,
          validate: (input) => {
            if (!input.trim()) {
              return 'Todo text cannot be empty';
            }
            return true;
          }
        }
      ]);

      updatedSection = editTodoInSection(todaySection, selectedTodoItem.lineNumber, newText);
      await replaceTodaySection(updatedSection);
      console.log(chalk.green('✓') + ' Todo updated!');
    } else if (action === 'view_context') {
      const contextText = getContextById(todaySection, selectedTodoItem.contextId);
      if (contextText) {
        console.log('\n' + chalk.cyan(`Context [${selectedTodoItem.contextId}]:`));
        console.log(contextText + '\n');
      } else {
        console.log(chalk.yellow('Context not found.'));
      }
    } else if (action === 'add_context') {
      const { contextText } = await inquirer.prompt([
        {
          type: 'input',
          name: 'contextText',
          message: 'Enter context for this todo:',
          validate: (input) => {
            if (!input.trim()) {
              return 'Context cannot be empty';
            }
            return true;
          }
        }
      ]);

      const newContextId = await generateUniqueThreeWordId(idExistsInAnyFile);
      await addContext(newContextId, contextText);

      todaySection = await initializeTodaySection();
      updatedSection = updateTodoContext(todaySection, selectedTodoItem.lineNumber, newContextId);
      await replaceTodaySection(updatedSection);
      console.log(chalk.green('✓') + ` Context added with ID: ${chalk.cyan(newContextId)}`);
    } else if (action === 'edit_context') {
      const currentContext = getContextById(todaySection, selectedTodoItem.contextId);
      const { newContextText } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newContextText',
          message: 'Enter new context:',
          default: currentContext || '',
          validate: (input) => {
            if (!input.trim()) {
              return 'Context cannot be empty';
            }
            return true;
          }
        }
      ]);

      await updateContext(selectedTodoItem.contextId, newContextText);
      console.log(chalk.green('✓') + ' Context updated!');
    } else if (action === 'delete_context') {
      await deleteContext(selectedTodoItem.contextId);

      todaySection = await initializeTodaySection();
      updatedSection = updateTodoContext(todaySection, selectedTodoItem.lineNumber, null);
      await replaceTodaySection(updatedSection);
      console.log(chalk.green('✓') + ' Context deleted!');
    }
  }

  console.log(chalk.green('✓') + ' All done!');
}
