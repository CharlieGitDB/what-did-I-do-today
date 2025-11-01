import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  initializeTodaySection,
  extractTodos,
  updateTodoInSection,
  replaceTodaySection,
  getContextById,
  addContext,
  updateContext,
  deleteContext,
  idExistsInAnyFile,
  getAllContexts
} from '../utils/fileHandler.js';
import { generateUniqueThreeWordId } from '../utils/wordGenerator.js';

/**
 * Displays the help header
 */
function displayHeader() {
  console.clear();
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('              📝  TODO MANAGER  📝                           ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.gray('  Quick Tips:'));
  console.log(chalk.gray('  • Use ') + chalk.white('SPACE') + chalk.gray(' to toggle todo completion'));
  console.log(chalk.gray('  • Use ') + chalk.white('ARROW KEYS') + chalk.gray(' to navigate'));
  console.log(chalk.gray('  • Use ') + chalk.white('ENTER') + chalk.gray(' to confirm selection'));
  console.log(chalk.gray('  • Contexts provide additional details for your todos'));
  console.log();
  console.log(chalk.gray('─'.repeat(63)));
  console.log();
}

/**
 * Displays todos in a formatted list
 * @param {Array} todos - Array of todo objects
 * @returns {string} Formatted todo list
 */
function displayTodoList(todos) {
  if (todos.length === 0) {
    return chalk.yellow('  No todos for today!');
  }

  let output = chalk.bold('  Your Todos:\n\n');
  todos.forEach((todo, index) => {
    const checkbox = todo.checked ? chalk.green('✓') : chalk.gray('○');
    const text = todo.checked ? chalk.gray.strikethrough(todo.text) : chalk.white(todo.text);
    const context = todo.contextId ? chalk.cyan(` 📎 ${todo.contextId}`) : '';
    output += `  ${checkbox} ${text}${context}\n`;
  });
  return output;
}

/**
 * Shows the main action menu
 * @returns {Promise<string>} Selected action
 */
async function showMainMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: chalk.bold('What would you like to do?'),
      pageSize: 10,
      choices: [
        { name: '✓  Toggle Todo Completion', value: 'toggle' },
        { name: '✏️   Edit Todo Text', value: 'edit' },
        { name: '➕  Add Context to Todo', value: 'add_context' },
        { name: '📝  Edit Todo Context', value: 'edit_context' },
        { name: '🗑️   Delete Todo', value: 'delete' },
        new inquirer.Separator(),
        { name: '📊  View All Contexts (Table)', value: 'view_contexts_table' },
        new inquirer.Separator(),
        { name: chalk.gray('↩   Exit'), value: 'exit' }
      ]
    }
  ]);
  return action;
}

/**
 * Allows user to toggle todo completion status
 * @param {Array} todos - Array of todo objects
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function toggleTodos(todos, todaySection) {
  const { selectedTodos } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedTodos',
      message: chalk.bold('Select completed todos (SPACE to toggle, ENTER when done):'),
      pageSize: 15,
      choices: todos.map((todo, index) => ({
        name: `${todo.text}${todo.contextId ? chalk.cyan(' 📎') : ''}`,
        value: index,
        checked: todo.checked
      }))
    }
  ]);

  let updatedSection = todaySection;

  // Update all todos based on selections
  todos.forEach((todo, index) => {
    const shouldBeChecked = selectedTodos.includes(index);
    if (todo.checked !== shouldBeChecked) {
      updatedSection = updateTodoInSection(updatedSection, todo.lineNumber, shouldBeChecked);
    }
  });

  await replaceTodaySection(updatedSection);
  console.log();
  console.log(chalk.green('  ✓ Todos updated successfully!'));
  console.log();
}

/**
 * Allows user to edit a todo's text
 * @param {Array} todos - Array of todo objects
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function editTodo(todos, todaySection) {
  const { selectedTodo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTodo',
      message: chalk.bold('Select a todo to edit:'),
      pageSize: 15,
      choices: [
        ...todos.map((todo, index) => ({
          name: `${todo.checked ? chalk.green('[✓]') : chalk.gray('[○]')} ${todo.text}${todo.contextId ? chalk.cyan(' 📎') : ''}`,
          value: index
        })),
        new inquirer.Separator(),
        { name: chalk.gray('← Back'), value: -1 }
      ]
    }
  ]);

  if (selectedTodo === -1) return;

  const selectedTodoItem = todos[selectedTodo];
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

  const lines = todaySection.split('\n');
  const line = lines[selectedTodoItem.lineNumber];

  if (line) {
    const todoMatch = line.match(/<li><ac:task><ac:task-status>(complete|incomplete)<\/ac:task-status><ac:task-body>(.+?)<\/ac:task-body><\/ac:task><\/li>/);
    if (todoMatch) {
      const status = todoMatch[1];
      const oldText = todoMatch[2];

      // Extract context if present
      const contextMatch = oldText.match(/\[context: ([^\]]+)\]$/);
      const contextPart = contextMatch ? ` [context: ${contextMatch[1]}]` : '';

      lines[selectedTodoItem.lineNumber] = `<li><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${newText}${contextPart}</ac:task-body></ac:task></li>`;
    }
  }

  await replaceTodaySection(lines.join('\n'));
  console.log();
  console.log(chalk.green('  ✓ Todo updated successfully!'));
  console.log();
}

/**
 * Allows user to delete a todo
 * @param {Array} todos - Array of todo objects
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function deleteTodo(todos, todaySection) {
  const { selectedTodo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTodo',
      message: chalk.bold('Select a todo to delete:'),
      pageSize: 15,
      choices: [
        ...todos.map((todo, index) => ({
          name: `${todo.checked ? chalk.green('[✓]') : chalk.gray('[○]')} ${todo.text}${todo.contextId ? chalk.cyan(' 📎') : ''}`,
          value: index
        })),
        new inquirer.Separator(),
        { name: chalk.gray('← Back'), value: -1 }
      ]
    }
  ]);

  if (selectedTodo === -1) return;

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow('Are you sure you want to delete this todo?'),
      default: false
    }
  ]);

  if (!confirm) return;

  const lines = todaySection.split('\n');
  lines.splice(todos[selectedTodo].lineNumber, 1);

  await replaceTodaySection(lines.join('\n'));
  console.log();
  console.log(chalk.green('  ✓ Todo deleted successfully!'));
  console.log();
}

/**
 * Allows user to add context to a todo
 * @param {Array} todos - Array of todo objects
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function addContextToTodo(todos, todaySection) {
  const todosWithoutContext = todos.filter(t => !t.contextId);

  if (todosWithoutContext.length === 0) {
    console.log();
    console.log(chalk.yellow('  All todos already have contexts!'));
    console.log();
    return;
  }

  const { selectedTodo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTodo',
      message: chalk.bold('Select a todo to add context:'),
      pageSize: 15,
      choices: [
        ...todos.map((todo, index) => ({
          name: `${todo.checked ? chalk.green('[✓]') : chalk.gray('[○]')} ${todo.text}${todo.contextId ? chalk.gray(' (has context)') : ''}`,
          value: index,
          disabled: todo.contextId ? 'Already has context' : false
        })),
        new inquirer.Separator(),
        { name: chalk.gray('← Back'), value: -1 }
      ]
    }
  ]);

  if (selectedTodo === -1) return;

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

  const lines = todaySection.split('\n');
  const selectedTodoItem = todos[selectedTodo];
  const line = lines[selectedTodoItem.lineNumber];

  if (line) {
    const todoMatch = line.match(/<li><ac:task><ac:task-status>(complete|incomplete)<\/ac:task-status><ac:task-body>(.+?)<\/ac:task-body><\/ac:task><\/li>/);
    if (todoMatch) {
      const status = todoMatch[1];
      const text = todoMatch[2];
      lines[selectedTodoItem.lineNumber] = `<li><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${text} [context: ${newContextId}]</ac:task-body></ac:task></li>`;
    }
  }

  await replaceTodaySection(lines.join('\n'));
  console.log();
  console.log(chalk.green('  ✓ Context added successfully! ID: ') + chalk.cyan(newContextId));
  console.log();
}

/**
 * Allows user to edit a todo's context
 * @param {Array} todos - Array of todo objects
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function editTodoContext(todos, todaySection) {
  const todosWithContext = todos.filter(t => t.contextId);

  if (todosWithContext.length === 0) {
    console.log();
    console.log(chalk.yellow('  No todos have contexts yet!'));
    console.log();
    return;
  }

  const { selectedTodo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTodo',
      message: chalk.bold('Select a todo to edit its context:'),
      pageSize: 15,
      choices: [
        ...todos.map((todo, index) => ({
          name: `${todo.checked ? chalk.green('[✓]') : chalk.gray('[○]')} ${todo.text}${todo.contextId ? chalk.cyan(` 📎 ${todo.contextId}`) : ''}`,
          value: index,
          disabled: !todo.contextId ? 'No context' : false
        })),
        new inquirer.Separator(),
        { name: chalk.gray('← Back'), value: -1 }
      ]
    }
  ]);

  if (selectedTodo === -1) return;

  const selectedTodoItem = todos[selectedTodo];
  const currentContext = getContextById(todaySection, selectedTodoItem.contextId);

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '👁️   View context', value: 'view' },
        { name: '✏️   Edit context text', value: 'edit' },
        { name: '🗑️   Remove context from todo', value: 'remove' },
        new inquirer.Separator(),
        { name: chalk.gray('← Back'), value: 'back' }
      ]
    }
  ]);

  if (action === 'back') return;

  if (action === 'view') {
    console.log();
    console.log(chalk.cyan.bold(`  Context [${selectedTodoItem.contextId}]:`));
    console.log(chalk.white(`  ${currentContext || 'No context found'}`));
    console.log();
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press ENTER to continue...'
      }
    ]);
  } else if (action === 'edit') {
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
    console.log();
    console.log(chalk.green('  ✓ Context updated successfully!'));
    console.log();
  } else if (action === 'remove') {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('Remove context from this todo? (Context will still exist for other todos)'),
        default: false
      }
    ]);

    if (confirm) {
      const lines = todaySection.split('\n');
      const line = lines[selectedTodoItem.lineNumber];

      if (line) {
        const todoMatch = line.match(/<li><ac:task><ac:task-status>(complete|incomplete)<\/ac:task-status><ac:task-body>(.+?)<\/ac:task-body><\/ac:task><\/li>/);
        if (todoMatch) {
          const status = todoMatch[1];
          let text = todoMatch[2];

          // Remove context reference
          text = text.replace(/\s*\[context: [^\]]+\]$/, '');

          lines[selectedTodoItem.lineNumber] = `<li><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${text}</ac:task-body></ac:task></li>`;
        }
      }

      await replaceTodaySection(lines.join('\n'));
      console.log();
      console.log(chalk.green('  ✓ Context removed from todo!'));
      console.log();
    }
  }
}

/**
 * Displays all contexts in a table format
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function viewContextsTable(todaySection) {
  const contexts = getAllContexts(todaySection);

  if (contexts.length === 0) {
    console.log();
    console.log(chalk.yellow('  No contexts found!'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold.cyan('  📊 All Contexts\n'));

  const table = new Table({
    head: [chalk.cyan('ID'), chalk.cyan('Context')],
    colWidths: [25, 40],
    wordWrap: true,
    style: {
      head: [],
      border: ['gray']
    }
  });

  contexts.forEach(ctx => {
    table.push([chalk.yellow(ctx.id), chalk.white(ctx.text)]);
  });

  console.log(table.toString());
  console.log();

  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press ENTER to continue...'
    }
  ]);
}

/**
 * Displays and allows management of todos for today
 * @returns {Promise<void>}
 */
export async function listTodos() {
  let running = true;

  while (running) {
    const todaySection = await initializeTodaySection();
    const todos = extractTodos(todaySection);

    displayHeader();

    if (todos.length === 0) {
      console.log(chalk.yellow('  No todos for today!'));
      console.log(chalk.gray('  Use ') + chalk.white('wdidt add "your todo"') + chalk.gray(' to create one.'));
      console.log();
      return;
    }

    console.log(displayTodoList(todos));
    console.log();

    const action = await showMainMenu();

    switch (action) {
      case 'toggle':
        await toggleTodos(todos, todaySection);
        break;
      case 'edit':
        await editTodo(todos, todaySection);
        break;
      case 'add_context':
        await addContextToTodo(todos, todaySection);
        break;
      case 'edit_context':
        await editTodoContext(todos, todaySection);
        break;
      case 'delete':
        await deleteTodo(todos, todaySection);
        break;
      case 'view_contexts_table':
        await viewContextsTable(todaySection);
        break;
      case 'exit':
        running = false;
        console.log();
        console.log(chalk.green('  ✓ All done! Have a great day!'));
        console.log();
        break;
    }
  }
}
