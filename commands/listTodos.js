import termkit from 'terminal-kit';
import inquirer from 'inquirer';
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
  getAllContexts,
  getTodosReferencingContext,
  getNextTodoId
} from '../utils/fileHandler.js';
import { generateUniqueThreeWordId } from '../utils/wordGenerator.js';

const term = termkit.terminal;

/**
 * Displays and allows management of todos for today with interactive keyboard controls
 * @returns {Promise<void>}
 */
export async function listTodos() {
  await showTodoTable();
}

/**
 * Shows the interactive todo table
 * @returns {Promise<void>}
 */
async function showTodoTable() {
  while (true) {
    term.clear();

    const todaySection = await initializeTodaySection();
    const todos = extractTodos(todaySection);

    if (todos.length === 0) {
      term.cyan('\n  📝 TODO MANAGER\n\n');
      term.yellow('  No todos for today!\n');
      term.gray('  Press ').white('A').gray(' to add a todo, or ').white('ESC').gray(' to exit.\n\n');

      const key = await waitForKey(['a', 'A', 'ESCAPE']);
      if (key === 'ESCAPE') {
        term('\n');
        return;
      }
      if (key === 'a' || key === 'A') {
        await addTodoInteractive();
        continue;
      }
    }

    // Display header
    term.cyan.bold('\n  📝 TODO MANAGER\n\n');
    term.gray('  ').white('SPACE').gray(': Toggle  ').white('E').gray(': Edit  ').white('D').gray(': Delete  ').white('A').gray(': Add  ').white('C').gray(': Contexts  ').white('ESC').gray(': Exit\n\n');

    // Prepare table data
    const tableData = [];
    tableData.push([
      term.str.cyan('✓'),
      term.str.cyan('ID'),
      term.str.cyan('Todo'),
      term.str.cyan('Context')
    ]);

    todos.forEach((todo, idx) => {
      const checkbox = todo.checked ? term.str.green('✓') : term.str.gray('○');
      const todoId = todo.todoId || term.str.gray('-');
      const text = todo.checked ? term.str.gray.dim(todo.text) : term.str.white(todo.text);
      const context = todo.contextId ? term.str.blue(`📎 ${todo.contextId}`) : term.str.gray('-');

      tableData.push([checkbox, todoId, text, context]);
    });

    // Display table
    term.table(tableData, {
      hasBorder: true,
      borderChars: 'light',
      borderAttr: { color: 'gray' },
      textAttr: { bgColor: 'default' },
      firstRowTextAttr: { bgColor: 'default' },
      width: term.width - 4,
      fit: true
    });

    term('\n  ').gray('Use ').white('↑↓').gray(' to navigate, then press a key...\n\n');

    // Show selection menu
    const todoChoices = todos.map((todo, idx) => {
      const checkbox = todo.checked ? '✓' : '○';
      const text = todo.checked ? `${todo.text}` : todo.text;
      const context = todo.contextId ? ` 📎 ${todo.contextId}` : '';
      return `${checkbox} ${text}${context}`;
    });

    try {
      const selectedIndex = await selectFromList(todoChoices);

      if (selectedIndex === -1) {
        // ESC pressed at selection
        term('\n');
        return;
      }

      // Wait for action key
      term.gray('\n  Selected: ').white(todoChoices[selectedIndex]).gray('\n  Press ').white('SPACE/E/D/C').gray(' or ').white('ESC').gray(' to go back...\n');

      const actionKey = await waitForKey(['SPACE', 'e', 'E', 'd', 'D', 'c', 'C', 'ESCAPE']);

      if (actionKey === 'ESCAPE') {
        continue;
      }

      const selectedTodo = todos[selectedIndex];

      if (actionKey === 'SPACE') {
        // Toggle completion
        const updatedSection = updateTodoInSection(todaySection, selectedTodo.lineNumber, !selectedTodo.checked);
        await replaceTodaySection(updatedSection);
      } else if (actionKey === 'e' || actionKey === 'E') {
        // Edit todo
        await editTodoInteractive(selectedTodo, todaySection);
      } else if (actionKey === 'd' || actionKey === 'D') {
        // Delete todo
        await deleteTodoInteractive(selectedTodo, todaySection);
      } else if (actionKey === 'c' || actionKey === 'C') {
        // View contexts
        await showContextTableForTodo(selectedTodo);
      }

    } catch (error) {
      if (error.message === 'ADD_TODO') {
        await addTodoInteractive();
      } else if (error.message === 'VIEW_CONTEXTS') {
        await showAllContextsTable();
      } else if (error.message === 'EXIT') {
        term('\n');
        return;
      } else {
        throw error;
      }
    }
  }
}

/**
 * Shows context table for a specific todo
 * @param {Object} todo - The todo object
 * @returns {Promise<void>}
 */
async function showContextTableForTodo(todo) {
  if (!todo.contextId) {
    term.yellow('\n  This todo has no context.\n');
    term.gray('  Press any key to continue...\n');
    await term.inputField({ echo: false }).promise;
    return;
  }

  const todaySection = await initializeTodaySection();
  const contextText = getContextById(todaySection, todo.contextId);

  term.clear();
  term.cyan.bold('\n  📎 CONTEXT VIEW\n\n');
  term.gray('  Press ').white('ESC').gray(' to go back to todos\n\n');

  // Display context info
  term('  ').yellow.bold(`Context ID: ${todo.contextId}\n\n`);
  term('  ').white(contextText || 'No context found').wrap('\n\n');

  // Show which todos reference this context
  const referencingTodos = getTodosReferencingContext(todaySection, todo.contextId);

  if (referencingTodos.length > 0) {
    term('  ').cyan('Linked Todos:\n');
    referencingTodos.forEach(t => {
      term('    ').green(`→ ${t.todoId}: `).white(t.text).wrap('\n');
    });
  }

  term('\n');
  await waitForKey(['ESCAPE']);
}

/**
 * Shows all contexts in a table view
 * @returns {Promise<void>}
 */
async function showAllContextsTable() {
  const todaySection = await initializeTodaySection();
  const contexts = getAllContexts(todaySection);

  term.clear();
  term.cyan.bold('\n  📊 ALL CONTEXTS\n\n');
  term.gray('  Press ').white('ESC').gray(' to go back\n\n');

  if (contexts.length === 0) {
    term.yellow('  No contexts found.\n\n');
    await waitForKey(['ESCAPE']);
    return;
  }

  // Prepare table data
  const tableData = [];
  tableData.push([
    term.str.cyan('ID'),
    term.str.cyan('Context'),
    term.str.cyan('Linked Todos')
  ]);

  contexts.forEach(ctx => {
    const referencingTodos = getTodosReferencingContext(todaySection, ctx.id);
    const todoLinks = referencingTodos.length > 0
      ? referencingTodos.map(t => `→ ${t.todoId}`).join(', ')
      : '(none)';

    tableData.push([
      term.str.yellow(ctx.id),
      term.str.white(ctx.text),
      term.str.green(todoLinks)
    ]);
  });

  // Display table
  term.table(tableData, {
    hasBorder: true,
    borderChars: 'light',
    borderAttr: { color: 'gray' },
    textAttr: { bgColor: 'default' },
    firstRowTextAttr: { bgColor: 'default' },
    width: term.width - 4,
    fit: true
  });

  term('\n');
  await waitForKey(['ESCAPE']);
}

/**
 * Prompts to add a new todo interactively
 * @returns {Promise<void>}
 */
async function addTodoInteractive() {
  term.grabInput(false);
  term.hideCursor(false);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'todoText',
      message: 'Enter todo text:',
      validate: (input) => {
        if (!input.trim()) {
          return 'Todo cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'wantContext',
      message: 'Add context to this todo?',
      default: false
    },
    {
      type: 'input',
      name: 'contextText',
      message: 'Enter context:',
      when: (answers) => answers.wantContext,
      validate: (input) => {
        if (!input.trim()) {
          return 'Context cannot be empty';
        }
        return true;
      }
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  const todaySection = await initializeTodaySection();
  const todoId = getNextTodoId(todaySection);
  let contextId = null;

  if (answers.contextText) {
    contextId = await generateUniqueThreeWordId(idExistsInAnyFile);
    await addContext(contextId, answers.contextText);
  }

  // Add todo to file
  const lines = todaySection.split('\n');
  let insertIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '</ul>') {
      insertIdx = i;
      break;
    }
  }

  if (insertIdx !== -1) {
    let todoLine;
    if (contextId) {
      todoLine = `<li id="todo-${todoId}"><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>${answers.todoText} <a href="#context-${contextId}" style="color: #0066cc;">📎 ${contextId}</a></ac:task-body></ac:task></li>`;
    } else {
      todoLine = `<li id="todo-${todoId}"><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>${answers.todoText}</ac:task-body></ac:task></li>`;
    }

    lines.splice(insertIdx, 0, todoLine);
    await replaceTodaySection(lines.join('\n'));
  }
}

/**
 * Edits a todo interactively
 * @param {Object} todo - The todo to edit
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function editTodoInteractive(todo, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  const { newText } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newText',
      message: 'Enter new todo text:',
      default: todo.text,
      validate: (input) => {
        if (!input.trim()) {
          return 'Todo text cannot be empty';
        }
        return true;
      }
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  const lines = todaySection.split('\n');
  const line = lines[todo.lineNumber];

  if (line) {
    const todoMatch = line.match(/<li(?:\s+id="(todo-\d+)")?><ac:task><ac:task-status>(complete|incomplete)<\/ac:task-status><ac:task-body>(.+?)<\/ac:task-body><\/ac:task><\/li>/);
    if (todoMatch) {
      const todoId = todoMatch[1];
      const status = todoMatch[2];
      const oldText = todoMatch[3];

      // Extract context if present
      const anchorMatch = oldText.match(/<a href="#context-([^"]+)"[^>]*>📎 [^<]+<\/a>/);
      const oldContextMatch = oldText.match(/\[context: ([^\]]+)\]$/);

      let contextPart = '';
      if (anchorMatch) {
        contextPart = ` <a href="#context-${anchorMatch[1]}" style="color: #0066cc;">📎 ${anchorMatch[1]}</a>`;
      } else if (oldContextMatch) {
        contextPart = ` <a href="#context-${oldContextMatch[1]}" style="color: #0066cc;">📎 ${oldContextMatch[1]}</a>`;
      }

      if (todoId) {
        lines[todo.lineNumber] = `<li id="${todoId}"><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${newText}${contextPart}</ac:task-body></ac:task></li>`;
      } else {
        lines[todo.lineNumber] = `<li><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${newText}${contextPart}</ac:task-body></ac:task></li>`;
      }
    }
  }

  await replaceTodaySection(lines.join('\n'));
}

/**
 * Deletes a todo interactively
 * @param {Object} todo - The todo to delete
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function deleteTodoInteractive(todo, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to delete this todo?',
      default: false
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  if (confirm) {
    const lines = todaySection.split('\n');
    lines.splice(todo.lineNumber, 1);
    await replaceTodaySection(lines.join('\n'));
  }
}

/**
 * Selects an item from a list with arrow keys
 * @param {Array<string>} choices - List of choices
 * @returns {Promise<number>} Selected index or -1 for ESC
 */
async function selectFromList(choices) {
  return new Promise((resolve) => {
    let selectedIndex = 0;

    const displayMenu = () => {
      term.moveTo(1, term.height - choices.length - 2);
      term.eraseDisplayBelow();

      choices.forEach((choice, idx) => {
        if (idx === selectedIndex) {
          term('  ').bgWhite.black(` ${choice} `)('\n');
        } else {
          term('  ').gray(choice)('\n');
        }
      });
    };

    displayMenu();

    term.grabInput(true);
    term.hideCursor(true);

    term.on('key', function handleKey(name) {
      if (name === 'UP') {
        selectedIndex = Math.max(0, selectedIndex - 1);
        displayMenu();
      } else if (name === 'DOWN') {
        selectedIndex = Math.min(choices.length - 1, selectedIndex + 1);
        displayMenu();
      } else if (name === 'ENTER') {
        term.removeListener('key', handleKey);
        resolve(selectedIndex);
      } else if (name === 'ESCAPE') {
        term.removeListener('key', handleKey);
        resolve(-1);
      } else if (name === 'a' || name === 'A') {
        term.removeListener('key', handleKey);
        throw new Error('ADD_TODO');
      } else if (name === 'c' || name === 'C') {
        term.removeListener('key', handleKey);
        throw new Error('VIEW_CONTEXTS');
      }
    });
  });
}

/**
 * Waits for specific keys to be pressed
 * @param {Array<string>} validKeys - List of valid key names
 * @returns {Promise<string>} The key that was pressed
 */
async function waitForKey(validKeys) {
  return new Promise((resolve) => {
    term.grabInput(true);
    term.hideCursor(true);

    term.once('key', function(name) {
      if (validKeys.includes(name)) {
        resolve(name);
      } else {
        // Wait for valid key
        term.once('key', arguments.callee);
      }
    });
  });
}
