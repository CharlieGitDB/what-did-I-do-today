import chalk from 'chalk';
import {
  initializeTodaySection,
  replaceTodaySection,
  readNotesFile,
  getPreviousDaySection,
  extractTodos,
  getNextTodoId
} from '../utils/fileHandler.js';
import { performAutoSync } from './sync.js';

/**
 * Carries over incomplete todos from the previous day to today
 * @returns {Promise<void>}
 */
export async function carryoverTodos() {
  try {
    // Initialize today's section first
    const todaySection = await initializeTodaySection();

    // Get the full file content to find previous day
    const content = await readNotesFile();
    const previousDaySection = getPreviousDaySection(content);

    if (!previousDaySection) {
      console.log(chalk.yellow('⚠ No previous day found. This might be the first day in your notes.'));
      return;
    }

    // Extract todos from previous day
    const previousTodos = extractTodos(previousDaySection.content);

    // Filter for incomplete todos only
    const incompleteTodos = previousTodos.filter(todo => !todo.checked);

    if (incompleteTodos.length === 0) {
      console.log(chalk.green('✓ No incomplete todos from yesterday. You\'re all caught up!'));
      return;
    }

    // Get today's section to append todos
    const lines = todaySection.split('\n');

    let todoSectionIdx = -1;
    let taskListIdx = -1;
    let insertIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === '<h3>Todos</h3>') {
        todoSectionIdx = i;
        continue;
      }

      if (todoSectionIdx !== -1 && taskListIdx === -1 && lines[i] === '<ac:task-list>') {
        taskListIdx = i;
        continue;
      }

      if (todoSectionIdx !== -1 && lines[i] === '</ac:task-list>') {
        insertIdx = i;
        break;
      }

      if (todoSectionIdx !== -1 && lines[i].startsWith('<h3>') && lines[i] !== '<h3>Todos</h3>') {
        break;
      }
    }

    if (insertIdx === -1 || taskListIdx === -1) {
      insertIdx = todoSectionIdx + 2;
    }

    // Get the starting todo ID for today
    let nextTodoId = getNextTodoId(todaySection);

    // Add each incomplete todo to today
    const newTodoLines = [];
    for (const todo of incompleteTodos) {
      // Reconstruct the todo line with new ID and preserve context links
      let todoLine;
      if (todo.contextIds && todo.contextIds.length > 0) {
        // Build context links
        const contextLinks = todo.contextIds.map(contextId =>
          `<a href="#context-${contextId}" style="color: #0066cc;">📎 ${contextId}</a>`
        ).join(' ');
        todoLine = `<ac:task><ac:task-id>${nextTodoId}</ac:task-id><ac:task-status>incomplete</ac:task-status><ac:task-body><span class="placeholder-inline-tasks">${todo.text} ${contextLinks}</span></ac:task-body></ac:task>`;
      } else {
        todoLine = `<ac:task><ac:task-id>${nextTodoId}</ac:task-id><ac:task-status>incomplete</ac:task-status><ac:task-body><span class="placeholder-inline-tasks">${todo.text}</span></ac:task-body></ac:task>`;
      }
      newTodoLines.push(todoLine);
      nextTodoId++;
    }

    // Insert all new todos
    lines.splice(insertIdx, 0, ...newTodoLines);

    await replaceTodaySection(lines.join('\n'));

    console.log(chalk.green('✓') + ` Carried over ${chalk.cyan(incompleteTodos.length)} incomplete todo${incompleteTodos.length > 1 ? 's' : ''} from yesterday.`);

    // Show the todos that were carried over
    console.log(chalk.gray('\nCarried over todos:'));
    incompleteTodos.forEach((todo, idx) => {
      console.log(chalk.gray(`  ${idx + 1}. ${todo.text}${todo.contextIds.length > 0 ? ' 📎' : ''}`));
    });
    console.log('');

    // Sync to Confluence if enabled (respects silentSync setting)
    await performAutoSync();

  } catch (error) {
    console.error(chalk.red('Error carrying over todos:'), error.message);
    throw error;
  }
}
