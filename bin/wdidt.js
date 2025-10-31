#!/usr/bin/env node

/**
 * @fileoverview Main CLI entry point for wdidt (What Did I Do Today)
 * A personal daily notes CLI tool for managing todos and notes
 */

import { Command } from 'commander';
import { addTodo } from '../commands/addTodo.js';
import { listTodos } from '../commands/listTodos.js';
import { addRef } from '../commands/addRef.js';
import { addNote } from '../commands/addNote.js';
import { configureConfluence } from '../commands/confluence.js';
import { syncToConfluence } from '../commands/sync.js';

const program = new Command();

program
  .name('wdidt')
  .description('What Did I Do Today - A personal daily notes CLI')
  .version('1.0.0');

program
  .command('add')
  .description('Add a todo item to today\'s notes')
  .argument('[text...]', 'Todo text (optional, will prompt if not provided)')
  .option('-c, --context <text>', 'Context for the todo')
  .action((text, options) => {
    addTodo(text.join(' '), options.context);
  });

program
  .command('todos')
  .description('View, toggle, edit, and delete todos for today')
  .action(listTodos);

program
  .command('ref')
  .description('Save a reference with a unique 3-word ID')
  .argument('[text...]', 'Reference content (optional, will prompt if not provided)')
  .action((text) => {
    addRef(text.join(' '));
  });

program
  .command('note')
  .description('Add a quick note')
  .argument('[text...]', 'Note content (optional, will prompt if not provided)')
  .action((text) => {
    addNote(text.join(' '));
  });

program
  .command('confluence')
  .description('Configure Confluence sync settings')
  .action(configureConfluence);

program
  .command('sync')
  .description('Sync all notes to Confluence')
  .action(syncToConfluence);

program.parse();
