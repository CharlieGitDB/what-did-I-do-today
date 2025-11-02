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
  .version('1.0.0')
  .argument('[text...]', 'Todo text (if no subcommand, adds a todo)')
  .option('-c, --context <text>', 'Context for the todo')
  .action((text, options) => {
    // If no arguments and no context flag, show help
    if ((!text || text.length === 0) && !options.context) {
      program.help();
    }

    // Default action: add a todo
    if (text && text.length > 0) {
      // Check if last argument looks like context (if no --context flag)
      // wdidt "todo" "context" - first arg is todo, second is context
      if (!options.context && text.length === 2) {
        addTodo(text[0], text[1]);
      } else {
        // wdidt todo text here --context context
        addTodo(text.join(' '), options.context);
      }
    } else {
      addTodo('', options.context);
    }
  });

program
  .command('add')
  .description('Add a todo item to today\'s notes')
  .argument('[text...]', 'Todo text (optional, will prompt if not provided)')
  .option('-c, --context <text>', 'Context for the todo')
  .action((text, options) => {
    // Check if we have exactly 2 arguments and no --context flag
    if (!options.context && text.length === 2) {
      addTodo(text[0], text[1]);
    } else {
      addTodo(text.join(' '), options.context);
    }
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

program
  .command('test-confluence')
  .description('Test Confluence connection and permissions')
  .option('--debug', 'Show debug information including auth header')
  .action(async (options) => {
    const chalk = (await import('chalk')).default;
    const { getConfig } = await import('../utils/config.js');
    const { ConfluenceClient } = await import('../utils/confluenceClient.js');

    console.log(chalk.blue('Testing Confluence Connection\n'));

    const config = await getConfig();

    if (!config || !config.confluence || !config.confluence.enabled) {
      console.log(chalk.yellow('⚠ Confluence sync is not configured.'));
      console.log(`Run ${chalk.cyan('wdidt confluence')} to set it up.\n`);
      return;
    }

    const { baseUrl, email, spaceKey, apiToken } = config.confluence;

    console.log(chalk.gray(`URL: ${baseUrl}`));
    console.log(chalk.gray(`Email: ${email}`));
    console.log(chalk.gray(`Space: ${spaceKey}`));

    if (options.debug) {
      console.log(chalk.gray(`API Token: ${apiToken.substring(0, 10)}...${apiToken.substring(apiToken.length - 4)}`));
      const authString = `${email}:${apiToken}`;
      const base64Auth = Buffer.from(authString).toString('base64');
      console.log(chalk.gray(`Auth Header: Basic ${base64Auth.substring(0, 20)}...${base64Auth.substring(base64Auth.length - 10)}`));
    }

    console.log('');

    const client = new ConfluenceClient(baseUrl, email, apiToken);

    try {
      console.log(chalk.gray('1. Testing authentication...'));
      const connected = await client.testConnection();

      if (!connected) {
        console.log(chalk.red('   ✗ Authentication failed\n'));
        console.log(chalk.yellow('   This usually means:'));
        console.log(chalk.yellow('   - API token is invalid or expired'));
        console.log(chalk.yellow('   - Email address is incorrect'));
        console.log(chalk.yellow('   - Token lacks necessary permissions\n'));
        return;
      }
      console.log(chalk.green('   ✓ Authentication successful\n'));

      console.log(chalk.gray('2. Testing space access...'));
      const spaceId = await client.getSpaceId(spaceKey);
      console.log(chalk.green(`   ✓ Space found (ID: ${spaceId})\n`));

      console.log(chalk.green('✅ All tests passed! Your Confluence configuration is working.\n'));
    } catch (error) {
      console.log(chalk.red(`   ✗ Error: ${error.message}\n`));
    }
  });

program.parse();
