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
 * Displays and allows management of todos for today with vim-style controls
 * @returns {Promise<void>}
 */
export async function listTodos() {
  await showTodoList();
}

/**
 * Shows the simple todo list with vim controls
 * @returns {Promise<void>}
 */
async function showTodoList() {
  let selectedIndex = 0;
  let running = true;

  term.grabInput(true);
  term.hideCursor(true);

  while (running) {
    const todaySection = await initializeTodaySection();
    const todos = extractTodos(todaySection);

    term.clear();
    term.cyan.bold('  📝 TODO MANAGER\n\n');
    term.gray('  ').white('j/k/↑↓').gray(': Navigate  ').white('SPACE').gray(': Toggle  ').white('e').gray(': Edit  ').white('d').gray(': Delete  ').white('a').gray(': Add  ').white('c').gray(': Context  ').white('ESC').gray(': Exit\n\n');

    if (todos.length === 0) {
      term.yellow('  No todos for today!\n');
      term.gray('  Press ').white('a').gray(' to add a todo or ').white('ESC').gray(' to exit.\n');
    } else {
      // Render todo list
      todos.forEach((todo, idx) => {
        const checkbox = todo.checked ? '[x]' : '[ ]';

        if (idx === selectedIndex) {
          // Selected item - inverted colors
          term.bgWhite.black(`  ${checkbox} ${todo.text}`);
          if (todo.contextId) term.bgWhite.blue(' 📎');
          term.bgWhite.black('  ').white('\n');
        } else {
          // Unselected item
          if (todo.checked) {
            term.gray(`  ${checkbox} `).gray.dim(todo.text);
          } else {
            term.gray(`  ${checkbox} `).white(todo.text);
          }
          if (todo.contextId) term.blue(' 📎');
          term('\n');
        }
      });

      // Ensure selectedIndex is valid
      if (selectedIndex >= todos.length) {
        selectedIndex = todos.length - 1;
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
      if (todos.length > 0) {
        selectedIndex = Math.max(0, selectedIndex - 1);
      }
    } else if (key === 'DOWN' || key === 'j') {
      if (todos.length > 0) {
        selectedIndex = Math.min(todos.length - 1, selectedIndex + 1);
      }
    } else if (key === ' ' || key === 'SPACE') {
      // Toggle completion
      if (todos.length > 0 && selectedIndex < todos.length) {
        const todo = todos[selectedIndex];
        const newStatus = !todo.checked;
        const updatedSection = updateTodoInSection(todaySection, todo.lineNumber, newStatus);
        await replaceTodaySection(updatedSection);

        // Verify the update worked by re-extracting
        const verifySection = await initializeTodaySection();
        const verifyTodos = extractTodos(verifySection);
        // Keep selection on same item
      }
    } else if (key === 'e' || key === 'E') {
      // Edit todo
      if (todos.length > 0 && selectedIndex < todos.length) {
        await editTodoInteractive(todos[selectedIndex], todaySection);
      }
    } else if (key === 'd' || key === 'D') {
      // Delete todo
      if (todos.length > 0 && selectedIndex < todos.length) {
        await deleteTodoInteractive(todos[selectedIndex], todaySection);
        if (selectedIndex >= todos.length - 1 && selectedIndex > 0) {
          selectedIndex--;
        }
      }
    } else if (key === 'a' || key === 'A') {
      // Add todo
      await addTodoInteractive();
    } else if (key === 'c' || key === 'C') {
      // View context for this todo
      if (todos.length > 0 && selectedIndex < todos.length) {
        await showContextViewForTodo(todos[selectedIndex]);
      }
    } else if (key === 'ESCAPE') {
      // Exit
      running = false;
    }
  }

  term.grabInput(false);
  term.hideCursor(false);
  term.clear();
}

/**
 * Shows context view for a specific todo
 * @param {Object} todo - The todo object
 * @returns {Promise<void>}
 */
async function showContextViewForTodo(todo) {
  let running = true;

  while (running) {
    const todaySection = await initializeTodaySection();

    // Refresh todo object from current file state
    const currentTodos = extractTodos(todaySection);
    let currentTodo = todo;
    if (todo.todoId) {
      const found = currentTodos.find(t => t.todoId === todo.todoId);
      if (found) {
        currentTodo = found;
      }
    }

    term.clear();
    term.cyan.bold('  📎 CONTEXT VIEW\n\n');
    term.gray('  Todo: ').white(currentTodo.text).gray('\n\n');
    term.gray('  ').white('a').gray(': Add Context  ').white('e').gray(': Edit  ').white('d').gray(': Delete  ').white('ESC').gray(': Back to Todos\n\n');

    if (!currentTodo.contextId) {
      term.yellow('  No context linked to this todo.\n');
      term.gray('  Press ').white('a').gray(' to add context or ').white('ESC').gray(' to go back.\n');
    } else {
      const contextText = getContextById(todaySection, currentTodo.contextId);

      term.yellow(`  [${currentTodo.contextId}]\n`);
      term.white(`  ${contextText || '(no content)'}\n\n`);

      // Show other todos linked to this context
      const linkedTodos = getTodosReferencingContext(todaySection, currentTodo.contextId);
      if (linkedTodos.length > 1) {
        term.gray('  Also linked to:\n');
        linkedTodos.forEach(t => {
          if (t.todoId !== currentTodo.todoId) {
            term.gray('    → ').white(t.text).gray('\n');
          }
        });
      }
    }

    term('\n');

    // Wait for keypress
    const key = await new Promise((resolve) => {
      term.once('key', (name) => resolve(name));
    });

    if (key === 'a' || key === 'A') {
      // Add context
      if (!currentTodo.contextId) {
        await addContextToTodoInteractive(currentTodo, todaySection);
      } else {
        // Show message that context already exists
        term.red('\n  This todo already has a context. Use ').white('e').red(' to edit or ').white('d').red(' to delete it first.\n');
        term.gray('  Press any key to continue...');
        await new Promise((resolve) => {
          term.once('key', () => resolve());
        });
      }
    } else if (key === 'e' || key === 'E') {
      // Edit context
      if (currentTodo.contextId) {
        await editContextInteractive(currentTodo.contextId);
      } else {
        // Show message that no context exists
        term.red('\n  This todo has no context to edit. Use ').white('a').red(' to add a context first.\n');
        term.gray('  Press any key to continue...');
        await new Promise((resolve) => {
          term.once('key', () => resolve());
        });
      }
    } else if (key === 'd' || key === 'D') {
      // Delete context link
      if (currentTodo.contextId) {
        await deleteContextFromTodoInteractive(currentTodo, todaySection);
        running = false; // Go back after deleting
      } else {
        // Show message that no context exists
        term.red('\n  This todo has no context to delete.\n');
        term.gray('  Press any key to continue...');
        await new Promise((resolve) => {
          term.once('key', () => resolve());
        });
      }
    } else if (key === 'ESCAPE') {
      // Go back
      running = false;
    }
  }
}

/**
 * Adds a new todo interactively
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
      message: 'Delete this todo?',
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
 * Adds context to a todo interactively
 * @param {Object} todo - The todo object
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function addContextToTodoInteractive(todo, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  const { contextText } = await inquirer.prompt([
    {
      type: 'input',
      name: 'contextText',
      message: 'Enter context:',
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

  const contextId = await generateUniqueThreeWordId(idExistsInAnyFile);
  await addContext(contextId, contextText);

  // Update the todo to link to this context
  const lines = todaySection.split('\n');
  const line = lines[todo.lineNumber];

  if (line) {
    const todoMatch = line.match(/<li(?:\s+id="(todo-\d+)")?><ac:task><ac:task-status>(complete|incomplete)<\/ac:task-status><ac:task-body>(.+?)<\/ac:task-body><\/ac:task><\/li>/);
    if (todoMatch) {
      const todoId = todoMatch[1];
      const status = todoMatch[2];
      const text = todoMatch[3];

      const contextLink = ` <a href="#context-${contextId}" style="color: #0066cc;">📎 ${contextId}</a>`;

      if (todoId) {
        lines[todo.lineNumber] = `<li id="${todoId}"><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${text}${contextLink}</ac:task-body></ac:task></li>`;
      } else {
        lines[todo.lineNumber] = `<li><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${text}${contextLink}</ac:task-body></ac:task></li>`;
      }
    }
  }

  await replaceTodaySection(lines.join('\n'));
  todo.contextId = contextId; // Update the todo object
}

/**
 * Edits context text interactively
 * @param {string} contextId - The context ID
 * @returns {Promise<void>}
 */
async function editContextInteractive(contextId) {
  term.grabInput(false);
  term.hideCursor(false);

  const todaySection = await initializeTodaySection();
  const currentText = getContextById(todaySection, contextId);

  const { newText } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newText',
      message: 'Enter new context:',
      default: currentText || '',
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

  await updateContext(contextId, newText);
}

/**
 * Deletes context link from a todo
 * @param {Object} todo - The todo object
 * @param {string} todaySection - Today's section content
 * @returns {Promise<void>}
 */
async function deleteContextFromTodoInteractive(todo, todaySection) {
  term.grabInput(false);
  term.hideCursor(false);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Remove context link from this todo?',
      default: false
    }
  ]);

  term.hideCursor(true);
  term.grabInput(true);

  if (confirm) {
    const lines = todaySection.split('\n');
    const line = lines[todo.lineNumber];

    if (line) {
      const todoMatch = line.match(/<li(?:\s+id="(todo-\d+)")?><ac:task><ac:task-status>(complete|incomplete)<\/ac:task-status><ac:task-body>(.+?)<\/ac:task-body><\/ac:task><\/li>/);
      if (todoMatch) {
        const todoId = todoMatch[1];
        const status = todoMatch[2];
        let text = todoMatch[3];

        // Remove context link
        text = text.replace(/\s*<a href="#context-[^"]+"[^>]*>📎 [^<]+<\/a>/, '').trim();
        text = text.replace(/\s*\[context: [^\]]+\]$/, '').trim();

        if (todoId) {
          lines[todo.lineNumber] = `<li id="${todoId}"><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${text}</ac:task-body></ac:task></li>`;
        } else {
          lines[todo.lineNumber] = `<li><ac:task><ac:task-status>${status}</ac:task-status><ac:task-body>${text}</ac:task-body></ac:task></li>`;
        }
      }
    }

    await replaceTodaySection(lines.join('\n'));
  }
}
